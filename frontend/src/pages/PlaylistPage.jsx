import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlaylist } from '@/context/PlaylistContext';
import { Play, Shuffle, ArrowLeft, ListMusic, Trash2, Music, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PlaylistPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { playlists, renamePlaylist, deletePlaylist, removeSongFromPlaylist } = usePlaylist();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');

    const playlist = playlists.find(p => p.id === id);

    useEffect(() => {
        if (playlist) setNameInput(playlist.name);
    }, [playlist?.name]);

    if (!playlist) {
        return (
            <div className="container max-w-4xl mx-auto px-4 py-16 text-center">
                <ListMusic className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Playlist not found</h2>
                <Button onClick={() => navigate('/')}>Go Home</Button>
            </div>
        );
    }

    const playTrack = (song, queue, index) => {
        window.dispatchEvent(new CustomEvent('playTrack', {
            detail: {
                title: song.title,
                artist: song.artist,
                img: song.img || song.image,
                album: song.album || null,
                album_id: song.album_id || null,
                search_term: song.search_term,
                queue,
                currentIndex: index,
            }
        }));
    };

    const handlePlayAll = () => {
        if (!playlist.songs.length) return;
        playTrack(playlist.songs[0], playlist.songs, 0);
    };

    const handleShuffle = () => {
        if (!playlist.songs.length) return;
        const shuffled = [...playlist.songs].sort(() => Math.random() - 0.5);
        playTrack(shuffled[0], shuffled, 0);
    };

    const handleRename = () => {
        if (nameInput.trim()) renamePlaylist(id, nameInput.trim());
        setEditingName(false);
    };

    const handleDelete = () => {
        if (confirm(`Delete "${playlist.name}"?`)) {
            deletePlaylist(id);
            navigate('/');
        }
    };

    // Mosaic cover — up to 4 cells in a 2×2 grid
    const coverSongs = playlist.songs.slice(0, 4);
    const emptyCells = Math.max(0, 4 - coverSongs.length);

    return (
        <div className="container max-w-4xl mx-auto px-4 py-8 pb-36">
            {/* Back */}
            <Button variant="ghost" className="mb-6 -ml-2 gap-1" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4" /> Home
            </Button>

            {/* Header */}
            <div className="flex items-start gap-6 mb-10">
                {/* Cover art */}
                <div className="w-36 h-36 md:w-48 md:h-48 rounded-2xl overflow-hidden shrink-0 shadow-xl ring-1 ring-white/10">
                    {playlist.songs.length > 0 ? (
                        <div className="grid grid-cols-2 w-full h-full">
                            {coverSongs.map((s, i) => (
                                <div key={i} className="w-full h-full overflow-hidden">
                                    <img
                                        src={s.img || s.image}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ))}
                            {[...Array(emptyCells)].map((_, i) => (
                                <div key={`e${i}`} className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                    <ListMusic className="h-5 w-5 text-zinc-600" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                            <ListMusic className="h-14 w-14 text-zinc-500" />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 pt-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Playlist</p>
                    {editingName ? (
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                autoFocus
                                value={nameInput}
                                onChange={e => setNameInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingName(false); }}
                                className="text-2xl font-bold bg-transparent border-b border-primary outline-none text-foreground flex-1"
                            />
                            <button onClick={handleRename} className="text-primary hover:text-primary/80"><Check className="h-5 w-5" /></button>
                            <button onClick={() => setEditingName(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 mb-2 group">
                            <h1 className="text-2xl md:text-4xl font-bold truncate">{playlist.name}</h1>
                            <button
                                onClick={() => setEditingName(true)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                    <p className="text-sm text-muted-foreground mb-5">
                        {playlist.songs.length} song{playlist.songs.length !== 1 ? 's' : ''}
                    </p>

                    {/* Controls */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button onClick={handlePlayAll} disabled={!playlist.songs.length} className="gap-2 px-6">
                            <Play className="h-4 w-4 fill-current" /> Play All
                        </Button>
                        <Button onClick={handleShuffle} disabled={!playlist.songs.length} variant="outline" className="gap-2">
                            <Shuffle className="h-4 w-4" /> Shuffle
                        </Button>
                        <Button
                            onClick={handleDelete}
                            variant="ghost"
                            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                        >
                            <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border mb-4" />

            {/* Song List */}
            {playlist.songs.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <Music className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No songs yet. Hit <strong>+</strong> on any track to add it here.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-1">
                    {playlist.songs.map((song, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors group cursor-pointer"
                            onClick={() => playTrack(song, playlist.songs, idx)}
                        >
                            <span className="text-xs text-muted-foreground w-5 text-center shrink-0 group-hover:hidden">{idx + 1}</span>
                            <Play className="h-3.5 w-3.5 text-primary hidden group-hover:block shrink-0 fill-current" />
                            <img
                                src={song.img || song.image}
                                alt={song.title}
                                className="w-10 h-10 rounded-md object-cover shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{song.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); removeSongFromPlaylist(id, song); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1.5 rounded-full hover:bg-destructive/10"
                                title="Remove from playlist"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
