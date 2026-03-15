import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAlbumTracks } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle, X, Play, Shuffle } from 'lucide-react';
import { addRecentItem } from '@/components/shared/RecentSearches';
import {
    SongListRow,
    AnimatedSectionHeader,
} from '@/components/cards/AnimatedCards';

export function AlbumDetail() {
    const { albumId } = useParams();
    const navigate = useNavigate();
    const [album, setAlbum] = useState(null);
    const [loading, setLoading] = useState(true);
    const [playError, setPlayError] = useState(null);

    // Track playing state
    const [currentPlayingId, setCurrentPlayingId] = useState(null);
    const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);

    useEffect(() => {
        const update = () => {
            const track = JSON.parse(localStorage.getItem('currentTrack') || 'null');
            const playing = localStorage.getItem('wasPlaying') === 'true';
            setCurrentPlayingId(track?.search_term);
            setIsPlayerPlaying(playing);
        };
        update();
        window.addEventListener('playTrack', update);
        const poll = setInterval(update, 500);
        return () => { window.removeEventListener('playTrack', update); clearInterval(poll); };
    }, []);

    useEffect(() => {
        const fetchAlbum = async () => {
            try {
                const data = await getAlbumTracks(albumId);
                setAlbum(data);
            } catch (error) {
                console.error('Failed to fetch album:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAlbum();
    }, [albumId]);

    const handlePlaySong = (song, songIndex) => {
        addRecentItem({
            type: 'song',
            id: song.search_term,
            title: song.title,
            artist: song.artist || album?.artist_name,
            image: song.image,
            album: song.album || album?.album_name || null,
            album_id: song.album_id || albumId || null,
            search_term: song.search_term,
        });
        window.dispatchEvent(new CustomEvent('playTrack', {
            detail: {
                title: song.title,
                artist: song.artist,
                img: song.image,
                album: song.album || album.album_name || null,
                album_id: song.album_id || albumId || null,
                search_term: song.search_term,
                playedIndex: songIndex,
                queue: album.songs,
                currentIndex: songIndex,
            }
        }));
    };

    const handlePlayAll = async () => {
        if (!album?.songs?.length) return;
        handlePlaySong(album.songs[0], 0);
    };

    const handleShuffle = () => {
        if (!album?.songs?.length) return;
        const shuffled = [...album.songs].sort(() => Math.random() - 0.5);
        window.dispatchEvent(new CustomEvent('playTrack', {
            detail: {
                title: shuffled[0].title,
                artist: shuffled[0].artist,
                img: shuffled[0].image,
                search_term: shuffled[0].search_term,
                queue: shuffled,
                currentIndex: 0,
            }
        }));
    };

    if (loading) {
        return (
            <div className="container max-w-4xl mx-auto px-4 py-8 text-center">
                <p className="text-muted-foreground">Loading album...</p>
            </div>
        );
    }

    if (!album) {
        return (
            <div className="container max-w-4xl mx-auto px-4 py-8 text-center">
                <p className="text-destructive">Album not found</p>
            </div>
        );
    }

    return (
        <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-6 pb-32">
            {/* Play error toast */}
            {playError && (
                <div className="fixed top-4 right-4 z-[150] max-w-sm">
                    <div className="flex items-start gap-3 bg-zinc-900 border border-red-800/50 text-sm text-red-300 px-4 py-3 rounded-xl shadow-2xl">
                        <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="flex-1">{playError}</p>
                        <button onClick={() => setPlayError(null)} className="text-zinc-500 hover:text-zinc-300">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            <Button variant="ghost" className="mb-4 -ml-2 text-white" onClick={() => navigate(-1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>

            {/* Album Header */}
            <div className="flex flex-col items-center text-center mb-8 px-2">
                <img
                    src={album.artwork}
                    alt={album.album_name}
                    className="w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-xl mx-auto mb-4 shadow-2xl object-cover"
                />
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 leading-tight px-2 text-white">
                    {album.album_name}
                </h1>
                <p className="text-base sm:text-lg text-zinc-400 mb-1 truncate max-w-full px-2">
                    {album.artist_name}
                </p>
                <p className="text-xs sm:text-sm text-zinc-500 mb-6">
                    {album.genre} • {album.track_count} tracks
                </p>

                {/* Play All & Shuffle Buttons */}
                <div className="flex items-center justify-center gap-2 sm:gap-4 w-full max-w-xs sm:max-w-none mt-2">
                    <Button
                        size="default"
                        onClick={handlePlayAll}
                        className="flex-1 sm:flex-none h-12 px-8 rounded-full bg-[#00f3ff] hover:bg-[#33f6ff] text-zinc-900 font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:shadow-[0_0_30px_rgba(0,243,255,0.5)] border-0 flex items-center gap-2"
                    >
                        <Play className="h-5 w-5 fill-current" />
                        Play
                    </Button>
                    <Button
                        size="default"
                        variant="outline"
                        onClick={handleShuffle}
                        className="flex-1 sm:flex-none h-12 px-8 rounded-full border-2 border-white/20 text-white font-bold tracking-widest uppercase hover:bg-white/10 hover:border-white/40 transition-all flex items-center gap-2"
                    >
                        <Shuffle className="h-4 w-4" />
                        Shuffle
                    </Button>
                </div>
            </div>

            {/* Track List */}
            <AnimatedSectionHeader title="Tracks" sub={`${album.songs.length} songs`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {album.songs.map((song, idx) => (
                    <SongListRow
                        key={idx}
                        song={{
                            ...song,
                            img: song.image,
                            artist: song.artist || album.artist_name,
                            album_id: song.album_id || albumId,
                            album: song.album || album.album_name
                        }}
                        index={idx}
                        delay={idx * 25}
                        active={currentPlayingId === song.search_term && isPlayerPlaying}
                        paused={currentPlayingId === song.search_term && !isPlayerPlaying}
                        onSelect={() => handlePlaySong(song, idx)}
                    />
                ))}
            </div>
        </div>
    );
}
