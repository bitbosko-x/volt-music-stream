import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCategorySongs } from '@/lib/api';
import { useInView } from '@/lib/useInView';
import { AnimatedSectionHeader, AnimatedAlbumCard } from '@/components/cards/AnimatedCards';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export function ChartsSection({ onSongPlay, onViewAll }) {
    const navigate = useNavigate();
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ref, inView] = useInView('400px');

    const [currentPlayingId, setCurrentPlayingId] = useState(null);
    const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
    useEffect(() => {
        const update = () => {
            const track = JSON.parse(localStorage.getItem('currentTrack') || 'null');
            setCurrentPlayingId(track?.search_term);
            setIsPlayerPlaying(localStorage.getItem('wasPlaying') === 'true');
        };
        update();
        window.addEventListener('playTrack', update);
        const int = setInterval(update, 500);
        return () => { window.removeEventListener('playTrack', update); clearInterval(int); };
    }, []);

    useEffect(() => {
        if (!inView) return;
        let cancelled = false;
        (async () => {
            try {
                const data = await getCategorySongs('charts_hindi');
                if (!cancelled && data?.songs) setSongs(data.songs.slice(0, 10));
            } catch (e) {
                console.error('Failed to fetch Hindi charts:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [inView]);

    return (
        <section ref={ref} style={{ padding: "0 0 36px", position: "relative" }}>
            {loading ? (
                <>
                    <AnimatedSectionHeader title="Top Hindi Charts" sub="Loading..." />
                    <div className="flex gap-4 overflow-x-auto pb-4">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="flex-shrink-0 w-40 h-40 bg-accent animate-pulse rounded-lg" />
                        ))}
                    </div>
                </>
            ) : songs.length > 0 ? (
                <>
                    <div className="flex justify-between items-end mb-4">
                        <AnimatedSectionHeader title="Top Hindi Charts" sub="Most popular Hindi songs" />
                        <Button variant="ghost" size="sm" onClick={onViewAll} className="gap-1 text-zinc-400 hover:text-white mb-4 -mt-2">
                            View All <ChevronRight className="h-4 w-4" />
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
                </>
            ) : null}
        </section>
    );
}
