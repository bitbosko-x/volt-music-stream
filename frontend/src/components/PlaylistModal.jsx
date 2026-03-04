import { useState, useRef, useEffect } from 'react';
import { usePlaylist } from '@/context/PlaylistContext';
import { Check, Plus, X, ListMusic, Trash2 } from 'lucide-react';

export function PlaylistModal() {
    const {
        playlists, modalSong, closeModal,
        createPlaylist, addSongToPlaylist, removeSongFromPlaylist, isSongInPlaylist,
    } = usePlaylist();

    const [newName, setNewName] = useState('');
    const [showInput, setShowInput] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const errorTimerRef = useRef(null);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => clearTimeout(errorTimerRef.current);
    }, []);

    const showError = (msg) => {
        setErrorMsg(msg);
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => setErrorMsg(''), 3500);
    };

    if (!modalSong) return null;

    const handleToggle = (playlist) => {
        if (isSongInPlaylist(playlist.id, modalSong)) {
            removeSongFromPlaylist(playlist.id, modalSong);
        } else {
            addSongToPlaylist(playlist.id, modalSong);
        }
    };

    const handleCreate = () => {
        if (!newName.trim()) return;
        showError('');
        const newId = `pl_${Date.now()}`;
        try {
            createPlaylist(newName.trim(), newId);
            addSongToPlaylist(newId, modalSong);
            setNewName('');
            setShowInput(false);
        } catch (error) {
            showError(error.message || "Failed to create playlist.");
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleCreate();
        if (e.key === 'Escape') { setShowInput(false); setNewName(''); showError(''); }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
                onClick={closeModal}
            />

            {/* Modal Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-[201] max-w-lg mx-auto">
                <div className="bg-zinc-900 rounded-t-2xl border border-white/10 shadow-2xl pb-safe">
                    {/* Handle */}
                    <div className="flex items-center justify-center pt-3 pb-1">
                        <div className="w-10 h-1 rounded-full bg-white/20" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <ListMusic className="h-4 w-4 text-primary" />
                            <p className="font-semibold text-white text-sm">Add to playlist</p>
                        </div>
                        <button onClick={closeModal} className="text-zinc-400 hover:text-white transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Song preview */}
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5">
                        <img src={modalSong.img || modalSong.image} alt={modalSong.title} className="w-10 h-10 rounded-md object-cover shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{modalSong.title}</p>
                            <p className="text-xs text-zinc-400 truncate">{modalSong.artist}</p>
                        </div>
                    </div>

                    {/* Playlist List */}
                    <div className="max-h-60 overflow-y-auto">
                        {playlists.length === 0 && !showInput && (
                            <p className="text-center text-zinc-500 text-sm py-6">No playlists yet</p>
                        )}
                        {playlists.map((pl) => {
                            const inList = isSongInPlaylist(pl.id, modalSong);
                            return (
                                <button
                                    key={pl.id}
                                    onClick={() => handleToggle(pl)}
                                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors group"
                                >
                                    <div className="w-10 h-10 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                                        <ListMusic className="h-4 w-4 text-zinc-400" />
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{pl.name}</p>
                                        <p className="text-xs text-zinc-500">{pl.songs.length} song{pl.songs.length !== 1 ? 's' : ''}</p>
                                    </div>
                                    {inList ? (
                                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                                            <Check className="h-3.5 w-3.5 text-black" />
                                        </div>
                                    ) : (
                                        <div className="w-6 h-6 rounded-full border border-white/20 group-hover:border-white/40 transition-colors shrink-0" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Create new playlist */}
                    <div className="border-t border-white/10 mt-1 px-5 py-3">
                        {showInput ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Playlist name..."
                                        className="flex-1 bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 focus:border-primary placeholder:text-zinc-500"
                                    />
                                    <button
                                        onClick={handleCreate}
                                        disabled={!newName.trim()}
                                        className="px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground text-sm font-medium transition-colors"
                                    >
                                        Create
                                    </button>
                                    <button
                                        onClick={() => { setShowInput(false); setNewName(''); showError(''); }}
                                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                {errorMsg && (
                                    <p className="text-red-400 text-xs px-1 animate-in fade-in slide-in-from-top-1">{errorMsg}</p>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => {
                                        if (playlists.length >= 8) {
                                            showError("Maximum 8 playlists allowed. Please delete one to free up space.");
                                        } else {
                                            setShowInput(true);
                                            showError('');
                                        }
                                    }}
                                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium w-full"
                                >
                                    <div className="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center">
                                        <Plus className="h-3.5 w-3.5" />
                                    </div>
                                    New Playlist
                                </button>
                                {!showInput && errorMsg && (
                                    <p className="text-red-400 text-xs px-1 animate-in fade-in slide-in-from-top-1">{errorMsg}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
