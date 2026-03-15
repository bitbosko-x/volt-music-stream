import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlaylist } from '@/context/PlaylistContext';
import { Play, Shuffle, ArrowLeft, ListMusic, Trash2, Music, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SongListRow } from '@/components/cards/AnimatedCards';

// Hook to track which song is currently playing
function useCurrentPlaying() {
    const [currentId, setCurrentId] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(null);

    useEffect(() => {
        const onTrackChange = (e) => {
            setCurrentId(e.detail?.search_term ?? null);
            setCurrentIndex(e.detail?.currentIndex ?? null);
            setIsPlaying(true);
        };
        const onPlayState = (e) => setIsPlaying(e.detail?.playing ?? false);
        window.addEventListener('trackChanged', onTrackChange);
        window.addEventListener('playerPlayState', onPlayState);
        return () => {
            window.removeEventListener('trackChanged', onTrackChange);
            window.removeEventListener('playerPlayState', onPlayState);
        };
    }, []);

    return { currentId, isPlaying, currentIndex };
}

// Swipeable row — swipe left to reveal delete button on mobile
function SwipeableSongRow({ song, index, active, paused, onSelect, onRemove }) {
    const [offset, setOffset] = useState(0);
    const [swiping, setSwiping] = useState(false);
    const startX = useRef(null);
    const THRESHOLD = 80; // px to trigger delete reveal

    const onTouchStart = useCallback((e) => {
        startX.current = e.touches[0].clientX;
        setSwiping(true);
    }, []);

    const onTouchMove = useCallback((e) => {
        if (startX.current === null) return;
        const dx = e.touches[0].clientX - startX.current;
        if (dx < 0) setOffset(Math.max(dx, -110));  // only left swipe, max 110px
    }, []);

    const onTouchEnd = useCallback(() => {
        setSwiping(false);
        if (offset < -THRESHOLD) {
            setOffset(-110); // snap open
        } else {
            setOffset(0); // snap closed
        }
        startX.current = null;
    }, [offset]);

    const closeSwipe = () => setOffset(0);

    return (
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 14 }}>
            {/* Delete button revealed on swipe */}
            <div
                style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0,
                    width: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(220, 38, 38, 0.85)',
                    borderRadius: 14,
                    zIndex: 0,
                    transition: swiping ? 'none' : 'opacity 0.2s',
                    opacity: offset < -10 ? 1 : 0,
                }}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); closeSwipe(); }}
                    style={{ color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 11 }}
                >
                    <Trash2 style={{ width: 20, height: 20 }} />
                    Remove
                </button>
            </div>

            {/* Row content — slides left */}
            <div
                style={{
                    transform: `translateX(${offset}px)`,
                    transition: swiping ? 'none' : 'transform 0.25s ease',
                    position: 'relative', zIndex: 1,
                }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onClick={offset !== 0 ? closeSwipe : undefined}
            >
                <SongListRow
                    song={song}
                    index={index}
                    delay={index * 30}
                    active={active}
                    paused={paused}
                    onSelect={onSelect}
                />
            </div>
        </div>
    );
}

export function PlaylistPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { playlists, renamePlaylist, deletePlaylist, removeSongFromPlaylist } = usePlaylist();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const { currentId, isPlaying, currentIndex } = useCurrentPlaying();

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
                        <Button
                            onClick={handlePlayAll}
                            disabled={!playlist.songs.length}
                            className="gap-2 px-6 h-11 rounded-full bg-[#00f3ff] hover:bg-[#33f6ff] text-zinc-900 font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:shadow-[0_0_30px_rgba(0,243,255,0.5)] border-0"
                        >
                            <Play className="h-4 w-4 fill-current" /> Play All
                        </Button>
                        <Button
                            onClick={handleShuffle}
                            disabled={!playlist.songs.length}
                            variant="outline"
                            className="gap-2 h-11 rounded-full border-2 border-white/20 text-white font-bold tracking-widest uppercase hover:bg-white/10 hover:border-white/40"
                        >
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
                <>
                    {/* Desktop hint */}
                    <p className="hidden md:block text-xs text-zinc-600 mb-3">Hover a row and click <strong>✕</strong> to remove a song.</p>
                    {/* Mobile hint */}
                    <p className="md:hidden text-xs text-zinc-600 mb-3">Swipe left on a song to remove it.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {playlist.songs.map((song, idx) => {
                            const normalizedSong = { ...song, img: song.img || song.image };
                            const isActive = currentId === song.search_term && isPlaying;
                            const isPaused = currentId === song.search_term && !isPlaying;

                            return (
                                <SwipeableSongRow
                                    key={`${song.search_term}-${idx}`}
                                    song={normalizedSong}
                                    index={idx}
                                    active={isActive}
                                    paused={isPaused}
                                    onSelect={() => playTrack(song, playlist.songs, idx)}
                                    onRemove={() => removeSongFromPlaylist(id, song)}
                                />
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
