import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getArtistSongs } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, AlertCircle, X, Play, Shuffle } from 'lucide-react';
import { addRecentItem } from '@/components/shared/RecentSearches';
import {
    SongListRow,
    AlbumListRow,
    AnimatedSectionHeader,
} from '@/components/cards/AnimatedCards';

export function ArtistDetail() {
    const { artistName } = useParams();
    const navigate = useNavigate();
    const [artist, setArtist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAllAlbums, setShowAllAlbums] = useState(false);
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
        const fetchArtist = async () => {
            try {
                const data = await getArtistSongs(decodeURIComponent(artistName));
                setArtist(data);
            } catch (error) {
                console.error('Failed to fetch artist:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchArtist();
    }, [artistName]);

    const handlePlaySong = (song, songIndex) => {
        addRecentItem({
            type: 'song',
            id: song.search_term,
            title: song.title,
            artist: song.artist,
            image: song.image,
            album: song.album || null,
            album_id: song.album_id || null,
            search_term: song.search_term,
        });
        window.dispatchEvent(new CustomEvent('playTrack', {
            detail: {
                title: song.title,
                artist: song.artist,
                img: song.image,
                album: song.album || null,
                album_id: song.album_id || null,
                search_term: song.search_term,
                playedIndex: songIndex,
                queue: artist.songs,
                currentIndex: songIndex,
            }
        }));
    };

    const handleShuffle = () => {
        if (!artist?.songs?.length) return;
        const shuffled = [...artist.songs].sort(() => Math.random() - 0.5);
        window.dispatchEvent(new CustomEvent('playTrack', {
            detail: {
                title: shuffled[0].title,
                artist: shuffled[0].artist,
                img: shuffled[0].image,
                album: shuffled[0].album || null,
                album_id: shuffled[0].album_id || null,
                search_term: shuffled[0].search_term,
                queue: shuffled,
                currentIndex: 0,
            }
        }));
    };

    if (loading) {
        return (
            <div className="container max-w-4xl mx-auto px-4 py-8 text-center">
                <p className="text-muted-foreground">Loading artist...</p>
            </div>
        );
    }

    if (!artist) {
        return (
            <div className="container max-w-4xl mx-auto px-4 py-8 text-center">
                <p className="text-destructive">Artist not found</p>
            </div>
        );
    }

    const albumsToShow = showAllAlbums ? artist.albums : (artist.albums || []).slice(0, 5);

    return (
        <div className="container max-w-4xl mx-auto px-4 py-8 pb-32">
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

            <Button variant="ghost" className="mb-6 text-white" onClick={() => navigate(-1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>

            {/* Artist Header */}
            <div className="text-center mb-8">
                {artist.artist_image ? (
                    <img
                        src={artist.artist_image}
                        alt={artist.artist_name}
                        className="w-36 h-36 sm:w-44 sm:h-44 rounded-full mx-auto mb-4 shadow-2xl object-cover ring-2 ring-white/10"
                    />
                ) : (
                    <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full mx-auto mb-4 bg-zinc-800 flex items-center justify-center ring-1 ring-white/10">
                        <User className="h-16 w-16 text-zinc-500" />
                    </div>
                )}
                <h1 className="text-3xl font-bold mb-1 text-white">{artist.artist_name}</h1>
                {artist.genre && (
                    <p className="text-zinc-400 mb-1">{artist.genre}</p>
                )}
                <p className="text-sm text-zinc-500 mb-6">{artist.songs?.length} songs</p>

                {/* Play All & Shuffle */}
                <div className="flex items-center justify-center gap-2 sm:gap-4 w-full max-w-xs sm:max-w-none mt-2">
                    <Button
                        size="default"
                        onClick={() => handlePlaySong(artist.songs[0], 0)}
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

            {/* Top Songs */}
            <div style={{ padding: '0 0 36px' }}>
                <AnimatedSectionHeader title="Top Songs" sub={`${artist.songs.length} tracks`} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {artist.songs.map((song, idx) => (
                        <SongListRow
                            key={idx}
                            song={{ ...song, img: song.image }}
                            index={idx}
                            delay={idx * 25}
                            active={currentPlayingId === song.search_term && isPlayerPlaying}
                            paused={currentPlayingId === song.search_term && !isPlayerPlaying}
                            onSelect={() => handlePlaySong(song, idx)}
                        />
                    ))}
                </div>
            </div>

            {/* Albums */}
            {artist.albums && artist.albums.length > 0 && (
                <div style={{ padding: '0 0 36px' }}>
                    <AnimatedSectionHeader title="Albums" sub={`${artist.albums.length} albums`} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {albumsToShow.map((album, idx) => (
                            <AlbumListRow
                                key={idx}
                                album={{ ...album, img: album.image }}
                                index={idx}
                                delay={idx * 25}
                                onClick={() => navigate(`/album/${album.album_id}`)}
                            />
                        ))}
                    </div>
                    {artist.albums.length > 5 && (
                        <div className="flex justify-center mt-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowAllAlbums(!showAllAlbums)}
                                className="border-white/20 text-white hover:bg-white/10"
                            >
                                {showAllAlbums ? 'Show Less' : `View All Albums (${artist.albums.length})`}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
