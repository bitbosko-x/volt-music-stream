import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTopArtists } from '@/lib/api';
import { AnimatedSectionHeader, AnimatedCityCard } from '@/components/cards/AnimatedCards';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { ArtistImage } from '@/components/shared/ArtistImage';

export function TopGlobalArtists({ onViewAll }) {
    const navigate = useNavigate();
    const [artists, setArtists] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchTopArtists = async () => {
            try {
                const data = await getTopArtists();
                if (isMounted && data && data.artists) {
                    setArtists(data.artists.slice(0, 10)); // Take top 10 for the row
                }
            } catch (error) {
                console.error('Failed to fetch top artists:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchTopArtists();
        return () => { isMounted = false; };
    }, []);

    const handleViewAll = () => {
        if (onViewAll) onViewAll(artists);
    };

    if (loading) {
        return (
            <section style={{ padding: "0 0 36px" }}>
                <AnimatedSectionHeader title="Top Global Artists" sub="Loading..." />
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-40 h-40 bg-accent animate-pulse rounded-2xl" />
                    ))}
                </div>
            </section>
        );
    }

    if (!artists || artists.length === 0) return null;

    return (
        <section style={{ padding: "0 0 36px", position: "relative" }}>
            <div className="flex justify-between items-end mb-4">
                <AnimatedSectionHeader title="Top Global Artists" sub="The biggest stars on Volt Music" />
                <Button variant="ghost" size="sm" onClick={handleViewAll} className="gap-1 text-zinc-400 hover:text-[#00f3ff] mb-4 -mt-2">
                    View All
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <div className="hscroll flex gap-4 overflow-x-auto pb-6 pt-2 custom-scrollbar">
                {artists.map((artist, idx) => (
                    <div
                        key={idx}
                        className="flex-shrink-0 cursor-pointer group w-[130px] sm:w-[170px]"
                        onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                    >
                        <div className="w-[130px] h-[130px] sm:w-[170px] sm:h-[170px] rounded-full overflow-hidden relative shadow-lg ring-1 ring-white/10 group-hover:ring-white/20 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all duration-300 transform group-hover:-translate-y-2">
                            <ArtistImage
                                name={artist.name}
                                src={artist.image || artist.img}
                                alt={artist.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                        <div className="mt-3 sm:mt-4 text-center px-2">
                            <h3 className="text-white font-bold text-sm sm:text-base truncate group-hover:text-[#00f3ff] transition-colors">{artist.name}</h3>
                            <p className="text-zinc-500 text-[10px] sm:text-xs mt-1 font-medium uppercase tracking-widest">Artist</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
