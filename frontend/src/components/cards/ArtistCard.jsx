import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { ArtistImage } from '@/components/shared/ArtistImage';

export function ArtistCard({ artist }) {
    return (
        <Link to={`/artist/${encodeURIComponent(artist.name)}`}>
            <Card className="flex items-center p-3 hover:bg-accent transition-all cursor-pointer group">
                <ArtistImage
                    name={artist.name}
                    src={artist.image}
                    alt={artist.name}
                    className="w-20 h-20 rounded-full object-cover mr-4"
                />
                <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate group-hover:text-primary transition-colors">
                        {artist.name}
                    </p>
                    {artist.genre && (
                        <p className="text-sm text-muted-foreground truncate">
                            {artist.genre}
                        </p>
                    )}
                </div>
                <Badge variant="secondary">ARTIST</Badge>
            </Card>
        </Link>
    );
}
