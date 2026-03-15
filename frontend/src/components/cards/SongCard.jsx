import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListPlus, CheckCircle2 } from 'lucide-react';
import { usePlaylist } from '@/context/PlaylistContext';

export function SongCard({ song, onPlay, isPlaying = false }) {
    const [currentlyPlaying, setCurrentlyPlaying] = useState(false);
    const navigate = useNavigate();
    const { openAddToPlaylist, isSongInAnyPlaylist, playlists } = usePlaylist();
    const inPlaylist = isSongInAnyPlaylist(song);

    useEffect(() => {
        // Check initial state from localStorage
        const checkIfPlaying = () => {
            try {
                const saved = localStorage.getItem('currentTrack');
                if (saved) {
                    const playingTrack = JSON.parse(saved);
                    const isThisSongPlaying =
                        playingTrack.title === song.title &&
                        playingTrack.artist === song.artist;
                    setCurrentlyPlaying(isThisSongPlaying);
                }
            } catch (e) {
                console.error("Error parsing currentTrack:", e);
                // Optional: localStorage.removeItem('currentTrack'); // Clear corrupt data
            }
        };

        checkIfPlaying();

        const handlePlayerUpdate = (e) => {
            // Check if this exact song is playing
            const playingTrack = e.detail;

            // If detail is null, player was closed
            if (!playingTrack) {
                setCurrentlyPlaying(false);
                return;
            }

            const isThisSongPlaying =
                playingTrack.title === song.title &&
                playingTrack.artist === song.artist;
            setCurrentlyPlaying(isThisSongPlaying);
        };

        window.addEventListener('playTrack', handlePlayerUpdate);
        return () => window.removeEventListener('playTrack', handlePlayerUpdate);
    }, [song]);

    // Parse multiple artists (separated by comma, &, or "feat.")
    const parseArtists = (artistString) => {
        if (!artistString) return [];

        // Split by common delimiters
        return artistString
            .split(/,|&|feat\.|ft\.|featuring/i)
            .map(artist => artist.trim())
            .filter(artist => artist.length > 0);
    };

    const artists = parseArtists(song.artist);

    const handleArtistClick = (artistName, e) => {
        e.stopPropagation(); // Prevent song play when clicking artist
        navigate(`/artist/${encodeURIComponent(artistName)}`);
    };

    const handleAlbumClick = (e) => {
        e.stopPropagation();
        if (song.album_id) navigate(`/album/${song.album_id}`);
    };

    return (
        <Card
            className={`flex items-center p-3 hover:bg-accent transition-all cursor-pointer group ${currentlyPlaying ? 'bg-primary/10' : ''}`}
            onClick={() => onPlay(song)}
        >
            <div className="relative mr-4">
                <img
                    src={song.image}
                    alt={song.title}
                    className="w-14 h-14 rounded-md object-cover"
                />
                {currentlyPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-md transition-all">
                        <div className="flex items-end gap-[2px] h-4 pb-1">
                            <div className="w-[3px] bg-white rounded-full animate-play-1"></div>
                            <div className="w-[3px] bg-white rounded-full animate-play-2"></div>
                            <div className="w-[3px] bg-white rounded-full animate-play-3"></div>
                            <div className="w-[3px] bg-white rounded-full animate-play-4"></div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`font-semibold truncate transition-colors ${currentlyPlaying ? 'text-primary' : 'group-hover:text-primary'
                    }`}>
                    {song.title}
                </p>
                <div className="text-sm text-muted-foreground truncate flex flex-wrap gap-1 items-center">
                    {artists.map((artist, index) => (
                        <span key={index} className="inline-flex items-center">
                            <button
                                onClick={(e) => handleArtistClick(artist, e)}
                                className="hover:text-primary hover:underline transition-colors"
                            >
                                {artist}
                            </button>
                            {index < artists.length - 1 && <span className="mx-1 text-muted-foreground/50">•</span>}
                        </span>
                    ))}
                </div>
                {song.album && song.album_id && (
                    <button
                        onClick={handleAlbumClick}
                        className="text-xs text-muted-foreground/70 hover:text-primary hover:underline transition-colors truncate max-w-full text-left mt-0.5"
                    >
                        💿 {song.album}
                    </button>
                )}
            </div>
            {/* Right actions */}
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={(e) => { e.stopPropagation(); openAddToPlaylist(song); }}
                    className={`p-1.5 rounded-full transition-colors ${inPlaylist
                            ? 'text-green-500 hover:text-green-400'
                            : 'text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100'
                        }`}
                    title={inPlaylist ? 'In a playlist' : 'Add to playlist'}
                >
                    {inPlaylist
                        ? <CheckCircle2 className="h-4 w-4 fill-green-500/20" />
                        : <ListPlus className="h-4 w-4" />}
                </button>
                {currentlyPlaying ? (
                    <Badge className="bg-primary text-primary-foreground">PLAYING</Badge>
                ) : (
                    <Badge variant="outline" className="bg-accent text-foreground font-medium">SONG</Badge>
                )}
            </div>
        </Card>
    );
}
