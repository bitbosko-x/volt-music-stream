import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

const STORAGE_KEY = 'volt_playlists';
const PlaylistContext = createContext(null);

export function PlaylistProvider({ children }) {
    const { currentUser, isGuest } = useAuth();
    const [playlists, setPlaylists] = useState([]);
    const [modalSong, setModalSong] = useState(null); // song to add; null = modal closed

    // Load initial data
    useEffect(() => {
        if (isGuest) {
            // Load from localStorage
            try {
                const data = localStorage.getItem(STORAGE_KEY);
                setPlaylists(data ? JSON.parse(data) : []);
            } catch {
                setPlaylists([]);
            }
        } else if (currentUser) {
            // Load from Firestore
            const userDocRef = doc(db, 'users', currentUser.uid);
            
            // Listen to changes
            const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    if (data.playlists) {
                        setPlaylists(data.playlists);
                    } else {
                        setPlaylists([]);
                    }
                } else {
                    setPlaylists([]);
                    // Optional: Merge local storage playlists on first login
                    try {
                        const localData = localStorage.getItem(STORAGE_KEY);
                        const localPlaylists = localData ? JSON.parse(localData) : [];
                        if (localPlaylists.length > 0) {
                            setDoc(userDocRef, { playlists: localPlaylists }, { merge: true });
                        }
                    } catch (e) { console.error(e) }
                }
            });

            return () => unsubscribe();
        }
    }, [currentUser, isGuest]);

    const savePlaylists = useCallback(async (newPlaylists) => {
        setPlaylists(newPlaylists); // Optimistic UI update
        if (isGuest) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newPlaylists));
        } else if (currentUser) {
            const userDocRef = doc(db, 'users', currentUser.uid);
            await setDoc(userDocRef, { playlists: newPlaylists }, { merge: true });
        }
    }, [currentUser, isGuest]);

    const handleCreate = useCallback((name, id, initialSong = null) => {
        if (playlists.length >= 8) {
            throw new Error("Maximum 8 playlists allowed. Please delete one to free up space.");
        }

        let finalName = name.trim();
        if (!finalName || finalName.toLowerCase().startsWith('new playlist')) {
            let count = 1;
            let generatedName = 'New Playlist 1';
            while (playlists.some(p => p.name.toLowerCase() === generatedName.toLowerCase())) {
                count++;
                generatedName = `New Playlist ${count}`;
            }
            finalName = generatedName;
        } else {
            if (playlists.some(p => p.name.toLowerCase() === finalName.toLowerCase())) {
                throw new Error(`A playlist named "${finalName}" already exists.`);
            }
        }

        const newPlaylist = {
            id: id || `pl_${Date.now()}`,
            name: finalName,
            createdAt: new Date().toISOString(),
            songs: initialSong ? [{
                title: initialSong.title,
                artist: initialSong.artist,
                img: initialSong.img || initialSong.image,
                album: initialSong.album || null,
                album_id: initialSong.album_id || null,
                search_term: initialSong.search_term || `${initialSong.title} ${initialSong.artist}`,
            }] : [],
        };
        savePlaylists([newPlaylist, ...playlists]);
    }, [playlists, savePlaylists]);

    const handleRename = useCallback((id, newName) => {
        const finalName = newName.trim();
        if (!finalName) return;

        const updatedPlaylists = playlists.map(pl => {
            if (pl.id !== id) return pl;
            if (pl.name.toLowerCase() !== finalName.toLowerCase()) {
                if (playlists.some(p => p.id !== id && p.name.toLowerCase() === finalName.toLowerCase())) {
                    throw new Error(`A playlist named "${finalName}" already exists.`);
                }
                return { ...pl, name: finalName };
            }
            return pl;
        });
        savePlaylists(updatedPlaylists);
    }, [playlists, savePlaylists]);

    const handleDelete = useCallback((id) => {
        const updated = playlists.filter(p => p.id !== id);
        savePlaylists(updated);
    }, [playlists, savePlaylists]);

    const songKey = (song) => `${song.title}||${song.artist}`;

    const handleAddSong = useCallback((playlistId, song) => {
        const updatedPlaylists = playlists.map(pl => {
            if (pl.id !== playlistId) return pl;
            const key = songKey(song);
            if (!pl.songs.find(s => songKey(s) === key)) {
                return {
                    ...pl,
                    songs: [...pl.songs, {
                        title: song.title,
                        artist: song.artist,
                        img: song.img || song.image,
                        album: song.album || null,
                        album_id: song.album_id || null,
                        search_term: song.search_term || `${song.title} ${song.artist}`,
                    }]
                };
            }
            return pl;
        });
        savePlaylists(updatedPlaylists);
    }, [playlists, savePlaylists]);

    const handleRemoveSong = useCallback((playlistId, song) => {
        const updatedPlaylists = playlists.map(pl => {
            if (pl.id !== playlistId) return pl;
            const key = songKey(song);
            return {
                ...pl,
                songs: pl.songs.filter(s => songKey(s) !== key)
            };
        });
        savePlaylists(updatedPlaylists);
    }, [playlists, savePlaylists]);

    const isSongInPlaylist = useCallback((playlistId, song) => {
        const pl = playlists.find(p => p.id === playlistId);
        if (!pl) return false;
        const key = songKey(song);
        return pl.songs.some(s => songKey(s) === key);
    }, [playlists]);

    const isSongInAnyPlaylist = useCallback((song) => {
        const key = songKey(song);
        return playlists.some(pl => pl.songs.some(s => songKey(s) === key));
    }, [playlists]);

    const openAddToPlaylist = useCallback((song) => setModalSong(song), []);
    const closeModal = useCallback(() => setModalSong(null), []);

    // Keep memory in sync if another tab changes localStorage (for guests)
    useEffect(() => {
        if (!isGuest) return;
        const onStorage = (e) => {
            if (e.key === STORAGE_KEY) {
                try {
                    setPlaylists(e.newValue ? JSON.parse(e.newValue) : []);
                } catch { }
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [isGuest]);

    return (
        <PlaylistContext.Provider value={{
            playlists,
            modalSong,
            openAddToPlaylist,
            closeModal,
            createPlaylist: handleCreate,
            renamePlaylist: handleRename,
            deletePlaylist: handleDelete,
            addSongToPlaylist: handleAddSong,
            removeSongFromPlaylist: handleRemoveSong,
            isSongInPlaylist,
            isSongInAnyPlaylist,
        }}>
            {children}
        </PlaylistContext.Provider>
    );
}

export function usePlaylist() {
    const ctx = useContext(PlaylistContext);
    if (!ctx) throw new Error('usePlaylist must be used inside PlaylistProvider');
    return ctx;
}
