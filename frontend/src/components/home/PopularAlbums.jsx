import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCategorySongs } from '@/lib/api';
import { useInView } from '@/lib/useInView';
import { AnimatedSectionHeader, AnimatedAlbumCard } from '@/components/cards/AnimatedCards';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export function PopularAlbums({ onViewAll }) {
    const navigate = useNavigate();
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ref, inView] = useInView('400px');

    useEffect(() => {
        if (!inView) return;
        let cancelled = false;
        (async () => {
            try {
                const data = await getCategorySongs('popular_albums');
                if (!cancelled && data?.albums) setAlbums(data.albums.slice(0, 10));
            } catch (e) {
                console.error('Failed to fetch popular albums:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [inView]);

    const handleViewAll = () => {
        // Just call the parent handler
        if (onViewAll) onViewAll();
    };

    return (
        <section ref={ref} style={{ padding: "0 0 36px", position: "relative" }}>
        {loading ? (
            <>
                <AnimatedSectionHeader title="Popular Albums" sub="Loading..." />
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {[...Array(6)].map((_, i) => <div key={i} className="flex-shrink-0 w-40 h-40 bg-accent animate-pulse rounded-lg" />)}
                </div>
            </>
        ) : albums.length === 0 ? null : (<>
            <div className="flex justify-between items-end mb-4">
                <AnimatedSectionHeader title="Popular Albums" sub="Top albums from around the world" />
                <Button variant="ghost" size="sm" onClick={handleViewAll} className="gap-1 text-zinc-400 hover:text-white mb-4 -mt-2">
                    View All
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <div className="hscroll">
                {albums.map((album, idx) => (
                    <AnimatedAlbumCard
                        key={idx}
                        wrapperClass={idx >= 3 ? 'hidden sm:block' : ''}
                        item={{ ...album, img: album.image }}
                        delay={idx % 10 * 65}
                        isPlaying={false}
                        onPlay={() => navigate(`/album/${album.album_id}`)}
                    />
                ))}
            </div>
        </>)}
        </section>
    );
}
