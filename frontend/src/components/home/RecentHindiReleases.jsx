import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCategorySongs } from '@/lib/api';
import { useInView } from '@/lib/useInView';
import { AnimatedSectionHeader, AnimatedAlbumCard } from '@/components/cards/AnimatedCards';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export function RecentHindiReleases({ onViewAll }) {
    const navigate = useNavigate();
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState(null);
    const [ref, inView] = useInView('400px');

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
        if (!inView) return;
        let cancelled = false;
        (async () => {
            try {
                const data = await getCategorySongs('recent_hindi_releases');
                if (!cancelled && data?.songs) setSongs(data.songs.slice(0, 10));
            } catch (e) {
                console.error('Failed to fetch recent hindi songs:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [inView]);

    const handlePlaySong = (song, idx) => {
        window.dispatchEvent(new CustomEvent('playTrack', {
            detail: {
                title: song.title,
                artist: song.artist,
                img: song.image || song.img,
                album: song.album || null,
                album_id: song.album_id || null,
                search_term: song.search_term,
                queue: songs,
                currentIndex: idx,
            }
        }));
    };

    const handleViewAll = () => {
        if (onViewAll) onViewAll();
    };

    return (
        <section ref={ref} style={{ padding: "0 0 36px", position: "relative" }}>
        {loading ? (
            <>
                <AnimatedSectionHeader title="Recent Hindi Releases" sub="Loading..." />
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {[...Array(6)].map((_, i) => <div key={i} className="flex-shrink-0 w-40 h-40 bg-accent animate-pulse rounded-lg" />)}
                </div>
            </>
        ) : songs.length === 0 ? null : (<>
            <div className="flex justify-between items-end mb-4">
                <AnimatedSectionHeader title="Recent Hindi Releases" sub="Latest Hindi tracks for you" />
                <Button variant="ghost" size="sm" onClick={handleViewAll} className="gap-1 text-zinc-400 hover:text-white mb-4 -mt-2">
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
                        onPlay={() => handlePlaySong(song, idx)}
                    />
                ))}
            </div>
        </>)}
        </section>
    );
}
