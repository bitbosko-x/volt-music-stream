import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

export function AlbumCard({ album }) {
    return (
        <Link to={`/album/${album.album_id}`}>
            <Card className="flex items-center p-3 hover:bg-accent transition-all cursor-pointer group">
                <img
                    src={album.image}
                    alt={album.title}
                    className="w-20 h-20 rounded-md object-cover mr-4"
                />
                <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate group-hover:text-primary transition-colors">
                        {album.title}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                        {album.artist}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {album.track_count} tracks
                    </p>
                </div>
                <Badge variant="secondary">ALBUM</Badge>
            </Card>
        </Link>
    );
}
