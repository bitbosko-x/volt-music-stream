import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchMusic } from '@/lib/api';
import { AnimatedSectionHeader, AnimatedAlbumCard } from '@/components/AnimatedCards';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export function ChartsSection({ onSongPlay, onViewAll }) {
    const navigate = useNavigate();
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Get current playing track id to animate playing cards
    const [currentPlayingId, setCurrentPlayingId] = useState(null);
    const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
    useEffect(() => {
        const updatePlayingState = () => {
            const track = JSON.parse(localStorage.getItem('currentTrack') || 'null');
            const wasPlaying = localStorage.getItem('wasPlaying') === 'true';
            setCurrentPlayingId(track?.search_term);
            setIsPlayerPlaying(wasPlaying);
        };
        updatePlayingState();
        window.addEventListener('playTrack', updatePlayingState);
        const int = setInterval(updatePlayingState, 500);
        return () => {
            window.removeEventListener('playTrack', updatePlayingState);
            clearInterval(int);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchHindiSongs = async () => {
            // Popular Hindi songs to search
            const searches = [
                'Tum Hi Ho Arijit Singh',
                'Kesariya Arijit Singh',
                'Apna Bana Le Arijit Singh',
                'Chaleya Arijit Singh',
                'Satranga Arijit Singh',
                'O Maahi Arijit Singh'
            ];

            try {
                const songData = await Promise.all(
                    searches.map(async (search) => {
                        try {
                            const data = await searchMusic(search);
                            if (data && data.songs && data.songs.length > 0) {
                                return data.songs[0];
                            }
                        } catch (e) {
                            console.error(`Failed to fetch chart song: ${search}`, e);
                        }
                        return null;
                    })
                );

                if (isMounted) {
                    setSongs(songData.filter(song => song !== null));
                }
            } catch (error) {
                console.error('Failed to fetch songs:', error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchHindiSongs();

        return () => { isMounted = false; };
    }, []);

    if (loading) {
        return (
            <section style={{ padding: "0 0 36px" }}>
                <AnimatedSectionHeader title="Top Hindi Charts" sub="Loading..." />
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-40 h-40 bg-accent animate-pulse rounded-lg" />
                    ))}
                </div>
            </section>
        );
    }

    if (!songs || songs.length === 0) return null;

    return (
        <section style={{ padding: "0 0 36px", position: "relative" }}>
            <div className="flex justify-between items-end mb-4">
                <AnimatedSectionHeader title="Top Hindi Charts" sub="Most popular Hindi songs" />
                <Button variant="ghost" size="sm" onClick={onViewAll} className="gap-1 text-zinc-400 hover:text-white mb-4 -mt-2">
                    View All
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <div className="hscroll">
                {songs.map((song, idx) => (
                    <AnimatedAlbumCard
                        key={idx}
                        wrapperClass={idx >= 3 ? 'hidden sm:block' : ''}
                        item={{ ...song, img: song.image, artist: song.artist }}
                        delay={idx % 10 * 65}
                        isPlaying={currentPlayingId === song.search_term && isPlayerPlaying}
                        onPlay={() => onSongPlay && onSongPlay(song)}
                    />
                ))}
            </div>
        </section>
    );
}
