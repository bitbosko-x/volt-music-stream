import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

export function PopularArtists() {
    const navigate = useNavigate();
    const [artists, setArtists] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchArtists = async () => {
            // Popular artist names in India
            const artistNames = [
                'Arijit Singh', 'Neha Kakkar', 'Atif Aslam',
                'Shreya Ghoshal', 'Badshah', 'Yo Yo Honey Singh'
            ];

            // Use consistent avatars since iTunes doesn't provide artist photos
            const artistData = artistNames.map((name, index) => {
                // Generate consistent color avatars with better colors
                const colors = ['3B82F6', 'EF4444', '10B981', 'F59E0B', '8B5CF6', 'EC4899'];
                const bgColor = colors[index];
                return {
                    name: name,
                    image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=300&background=${bgColor}&color=fff&bold=true&font-size=0.4`
                };
            });

            setArtists(artistData);
            setLoading(false);
        };

        fetchArtists();
    }, []);

    const handleViewAll = () => {
        // Search for "indian artists" to show diverse results
        navigate('/?q=hindi+songs');
    };

    if (loading) {
        return (
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Popular Artists</h2>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-40 h-48 bg-accent animate-pulse rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Popular Artists</h2>
                <Button variant="ghost" size="sm" onClick={handleViewAll} className="gap-1">
                    View All
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {artists.map((artist, idx) => (
                    <Card
                        key={idx}
                        onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                        className="flex-shrink-0 w-40 p-3 hover:bg-accent transition-all cursor-pointer group"
                    >
                        <div className="aspect-square mb-3 overflow-hidden rounded-full">
                            <img
                                src={artist.image}
                                alt={artist.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                        </div>
                        <p className="font-semibold text-center text-sm truncate">{artist.name}</p>
                        <p className="text-xs text-muted-foreground text-center">Artist</p>
                    </Card>
                ))}
            </div>
        </div>
    );
}
