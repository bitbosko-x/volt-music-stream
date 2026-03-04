const STORAGE_KEY = 'volt_playlists';

export function getPlaylists() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function savePlaylists(playlists) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
}

export function createPlaylist(name, id) {
    const playlists = getPlaylists();
    if (playlists.length >= 8) {
        throw new Error("Maximum 8 playlists allowed. Please delete one to free up space.");
    }

    let finalName = name.trim();
    if (!finalName || finalName.toLowerCase().startsWith('new playlist')) {
        // Auto-increment logic
        let count = 1;
        let generatedName = 'New Playlist 1';
        // Keep checking until we find an unused generated name
        while (playlists.some(p => p.name.toLowerCase() === generatedName.toLowerCase())) {
            count++;
            generatedName = `New Playlist ${count}`;
        }
        finalName = generatedName;
    } else {
        // User provided a manual name - validate it's unique
        if (playlists.some(p => p.name.toLowerCase() === finalName.toLowerCase())) {
            throw new Error(`A playlist named "${finalName}" already exists.`);
        }
    }

    const newPlaylist = {
        id: id || `pl_${Date.now()}`,
        name: finalName,
        createdAt: new Date().toISOString(),
        songs: [],
    };
    playlists.unshift(newPlaylist);
    savePlaylists(playlists);
    return newPlaylist;
}

export function renamePlaylist(playlistId, newName) {
    const playlists = getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);

    const finalName = newName.trim();
    if (!finalName) return; // ignore empty rename

    if (pl && pl.name.toLowerCase() !== finalName.toLowerCase()) {
        if (playlists.some(p => p.id !== playlistId && p.name.toLowerCase() === finalName.toLowerCase())) {
            throw new Error(`A playlist named "${finalName}" already exists.`);
        }
        pl.name = finalName;
    }
    savePlaylists(playlists);
}

export function deletePlaylist(playlistId) {
    const playlists = getPlaylists().filter(p => p.id !== playlistId);
    savePlaylists(playlists);
}

function songKey(song) {
    return `${song.title}||${song.artist}`;
}

export function addSongToPlaylist(playlistId, song) {
    const playlists = getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;
    const key = songKey(song);
    if (!pl.songs.find(s => songKey(s) === key)) {
        pl.songs.push({
            title: song.title,
            artist: song.artist,
            img: song.img || song.image,
            album: song.album || null,
            album_id: song.album_id || null,
            search_term: song.search_term || `${song.title} ${song.artist}`,
        });
    }
    savePlaylists(playlists);
}

export function removeSongFromPlaylist(playlistId, song) {
    const playlists = getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;
    const key = songKey(song);
    pl.songs = pl.songs.filter(s => songKey(s) !== key);
    savePlaylists(playlists);
}

export function isSongInPlaylist(playlistId, song) {
    const pl = getPlaylists().find(p => p.id === playlistId);
    if (!pl) return false;
    const key = songKey(song);
    return pl.songs.some(s => songKey(s) === key);
}

export function isSongInAnyPlaylist(song) {
    const key = songKey(song);
    return getPlaylists().some(pl => pl.songs.some(s => songKey(s) === key));
}
