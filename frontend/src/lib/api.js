const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const searchMusic = async (query, offset = 0) => {
    const response = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, offset }),
    });
    if (response.status === 429) {
        throw new Error('rate_limit_exceeded');
    }
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Search failed');
    }
    return response.json();
};

export const getAlbumTracks = async (albumId) => {
    const response = await fetch(`${API_BASE}/album/${albumId}`);
    if (response.status === 429) {
        throw new Error('rate_limit_exceeded');
    }
    if (!response.ok) throw new Error('Album not found');
    return response.json();
};

export const getArtistSongs = async (artistName) => {
    const response = await fetch(`${API_BASE}/artist/${encodeURIComponent(artistName)}`);
    if (response.status === 429) {
        throw new Error('rate_limit_exceeded');
    }
    if (!response.ok) throw new Error('Artist not found');
    return response.json();
};

export const getCategorySongs = async (categoryId) => {
    const response = await fetch(`${API_BASE}/category/${categoryId}`);
    if (response.status === 429) {
        throw new Error('rate_limit_exceeded');
    }
    if (!response.ok) throw new Error('Category not found');
    return response.json();
};

export const getAudioStream = async (searchTerm, artistName = null) => {
    const response = await fetch(`${API_BASE}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_term: searchTerm, artist: artistName }),
    });
    if (response.status === 429) {
        throw new Error('rate_limit_exceeded');
    }
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get audio stream');
    }
    return response.json();
};

export const getVideoPreview = async (query) => {
    try {
        const response = await fetch(`${API_BASE}/video-preview?q=${encodeURIComponent(query)}`);
        if (response.status === 429) {
            throw new Error('rate_limit_exceeded');
        }
        if (!response.ok) return null;
        const data = await response.json();
        return data.video_url;
    } catch (e) {
        return null;
    }
};

export const getTopArtists = async () => {
    const response = await fetch(`${API_BASE}/top-artists`);
    if (response.status === 429) {
        throw new Error('rate_limit_exceeded');
    }
    if (!response.ok) throw new Error('Failed to fetch top artists');
    return response.json();
};
