import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SearchBar } from '@/components/shared/SearchBar';
import { RecentSearches, addRecentItem } from '@/components/shared/RecentSearches';
import { Button } from '@/components/ui/button';
import { searchMusic, getCategorySongs } from '@/lib/api';
import { Music, Disc, User, ListMusic, Plus, AlertCircle, X, Zap, Play, Shuffle } from 'lucide-react';
import { SkeletonCard } from '@/components/cards/SkeletonCard';
import { usePlaylist } from '@/context/PlaylistContext';
import { AnimatedLogo } from '@/components/shared/AnimatedLogo';

import {
    AnimatedAlbumCard,
    AnimatedCityCard,
    AnimatedCategoryCard,
    AnimatedTrendingRow,
    AnimatedSectionHeader,
    SongListRow,
    AlbumListRow,
} from '@/components/cards/AnimatedCards';

// Restored old components
import { FeaturedCategories } from '@/components/home/FeaturedCategories';
import { PopularAlbums } from '@/components/home/PopularAlbums';
import { TopGlobalArtists } from '@/components/home/TopGlobalArtists';
import { ChartsSection } from '@/components/home/ChartsSection';
import { CategorySection } from '@/components/home/CategorySection';
import { SongCard } from '@/components/cards/SongCard';
import { AlbumCard } from '@/components/cards/AlbumCard';
import { ArtistCard } from '@/components/cards/ArtistCard';
import { FocusSection } from '@/components/home/FocusSection';
import { RecentHindiReleases } from '@/components/home/RecentHindiReleases';
import { NoCopyrightSection } from '@/components/home/NoCopyrightSection';
import { ArtistImage } from '@/components/shared/ArtistImage';

export function Home() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { playlists, openAddToPlaylist, createPlaylist } = usePlaylist();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [currentCategory, setCurrentCategory] = useState(null);
    const [searchError, setSearchError] = useState(null);
    const [playError, setPlayError] = useState(null);
    const playErrorTimer = useRef(null);

    // Per-section View All state (search results only)
    const [showAllSongs, setShowAllSongs] = useState(false);
    const [showAllAlbums, setShowAllAlbums] = useState(false);
    const [showAllArtists, setShowAllArtists] = useState(false);

    // Mobile Search State
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    // Animation state
    const [heroIn, setHeroIn] = useState(false);
    useEffect(() => { const t = setTimeout(() => setHeroIn(true), 80); return () => clearTimeout(t); }, []);

    // Fetch real trending data
    const [trendingSongs, setTrendingSongs] = useState([]);
    useEffect(() => {
        let isMounted = true;
        const fetchTrending = async () => {
            try {
                const data = await searchMusic('trending global hits');
                if (isMounted && data && data.songs) {
                    setTrendingSongs(data.songs.slice(0, 5));
                }
            } catch (err) {
                console.error('Trending fetch error:', err);
            }
        };
        fetchTrending();
        return () => { isMounted = false; };
    }, []);

    // Get current playing track id from localStorage to animate playing cards
    const [currentPlayingId, setCurrentPlayingId] = useState(null);
    const [currentPlayingIndex, setCurrentPlayingIndex] = useState(null);
    const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
    useEffect(() => {
        const updatePlayingState = () => {
            const track = JSON.parse(localStorage.getItem('currentTrack') || 'null');
            const wasPlaying = localStorage.getItem('wasPlaying') === 'true';
            setCurrentPlayingId(track?.search_term);
            setCurrentPlayingIndex(track?.playedIndex ?? null);
            setIsPlayerPlaying(wasPlaying);
        };
        updatePlayingState();
        window.addEventListener('playTrack', updatePlayingState);
        // We'd ideally need a way to listen for pause/play too, so we poll for simplicity here
        const int = setInterval(updatePlayingState, 500);
        return () => {
            window.removeEventListener('playTrack', updatePlayingState);
            clearInterval(int);
        };
    }, []);

    const lastSearchRef = useState({ query: null, offset: -1 })[0]; // Use mutable ref-like object stable across renders

    // Auto-clear play error after 3.5 seconds
    const showPlayError = (msg) => {
        setPlayError(msg);
        clearTimeout(playErrorTimer.current);
        playErrorTimer.current = setTimeout(() => setPlayError(null), 3500);
    };

    // Load search results from URL on mount or when URL params change
    useEffect(() => {
        const queryParam = searchParams.get('q');

        // Prevent duplicate search for same query
        if (queryParam) {
            // Forcefully clear currentCategory if the user executes a search from the navbar
            if (currentCategory) {
                setCurrentCategory(null);
            }
            if (lastSearchRef.query !== queryParam) {
                lastSearchRef.query = queryParam;
                setQuery(queryParam);
                setSearchError(null);
                executeSearch(queryParam, 0);
            }
        } else if (!queryParam) {
            // Reset to home if no query
            if (results !== null) {
                setResults(null);
                setQuery('');
                setSearchError(null);
                lastSearchRef.query = null;
            }
            if (currentCategory !== null) {
                setCurrentCategory(null);
            }
        }
    }, [searchParams, currentCategory]);

    const executeSearch = async (searchQuery) => {
        setLoading(true);
        setResults(null);
        // Reset View All state on each new search
        setShowAllSongs(false);
        setShowAllAlbums(false);
        setShowAllArtists(false);

        try {
            const data = await searchMusic(searchQuery, 0);
            setResults(data);
        } catch (error) {
            console.error('Search failed:', error);
            if (error?.message === 'rate_limit_exceeded') {
                setSearchError("Too many requests. Please wait a moment and try again.");
            } else {
                setSearchError(error?.message || 'Search failed. Check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (searchQuery) => {
        // Just update URL - useEffect will trigger the search
        setCurrentCategory(null);
        setSearchParams({ q: searchQuery });
        setQuery(searchQuery);
    };

    const handleCategoryClick = async (categoryInfo) => {
        setLoading(true);
        setCurrentCategory(categoryInfo);
        setQuery('');
        setSearchParams({}); // Clear query param
        setResults(null);

        try {
            let data;
            // Categories that should only show songs, not albums
            const songsOnlyCategories = ['top100', 'charts_hindi', 'latest', 'trending', 'hits', 'recent_hindi_releases'];

            if (categoryInfo.id === 'top_global_artists') {
                const { getTopArtists } = await import('@/lib/api');
                data = await getTopArtists();
            } else if (categoryInfo.query) {
                // Search-based category (Made For You, Focus, etc.)
                data = await searchMusic(categoryInfo.query, 0);

                // Filter out albums for song-only categories
                if (songsOnlyCategories.includes(categoryInfo.id)) {
                    data = { ...data, albums: [] };
                }
            } else if (categoryInfo.artistsList) {
                // Direct array of artists passed from "View All"
                data = { artists: categoryInfo.artistsList, songs: [], albums: [] };
            } else {
                // ID-based category (Featured)
                data = await getCategorySongs(categoryInfo.id);
            }
            setResults(data);
        } catch (error) {
            console.error('Category fetch failed:', error);
            if (error?.message === 'rate_limit_exceeded') {
                setSearchError("Too many requests. Please wait a moment and try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRecentSearchClick = (searchQuery) => {
        handleSearch(searchQuery);
    };

    const handlePlaySong = (song, listIndex) => {
        // Track in Recent Activity
        addRecentItem({
            type: 'song',
            id: song.search_term,
            title: song.title,
            artist: song.artist,
            image: song.image || song.img,
            album: song.album || null,
            album_id: song.album_id || null,
            search_term: song.search_term,
        });
        const trackData = {
            title: song.title,
            artist: song.artist,
            img: song.image || song.img,
            album: song.album || null,
            album_id: song.album_id || null,
            search_term: song.search_term,
            // Store list index so duplicate-title songs can be uniquely identified in the UI
            playedIndex: listIndex ?? null,
        };
        // If viewing a category, add queue support
        if (currentCategory && results && results.songs) {
            const songIndex = results.songs.findIndex(s => s.search_term === song.search_term);
            if (songIndex !== -1) {
                trackData.queue = results.songs;
                trackData.currentIndex = songIndex;
            }
        }
        window.dispatchEvent(new CustomEvent('playTrack', { detail: trackData }));
    };

    const handlePlayAll = () => {
        if (!results || !results.songs || results.songs.length === 0) return;
        const firstSong = results.songs[0];
        window.dispatchEvent(new CustomEvent('playTrack', {
            detail: {
                title: firstSong.title,
                artist: firstSong.artist,
                img: firstSong.image || firstSong.img,
                album: firstSong.album || null,
                album_id: firstSong.album_id || null,
                search_term: firstSong.search_term,
                queue: results.songs,
                currentIndex: 0,
            }
        }));
    };

    const handleShuffle = () => {
        if (!results || !results.songs || results.songs.length === 0) return;
        const shuffled = [...results.songs].sort(() => Math.random() - 0.5);
        const firstSong = shuffled[0];
        window.dispatchEvent(new CustomEvent('playTrack', {
            detail: {
                title: firstSong.title,
                artist: firstSong.artist,
                img: firstSong.image,
                album: firstSong.album || null,
                album_id: firstSong.album_id || null,
                search_term: firstSong.search_term,
                queue: shuffled,
                currentIndex: 0,
            }
        }));
    };

    const handleBackToHome = () => {
        setResults(null);
        setCurrentCategory(null);
        setQuery('');
        setSearchParams({});
    };

    return (
        <div className="container max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12 py-8 pb-32 relative">
            {/* Play error toast — top-right floating notification */}
            {playError && (
                <div className="fixed top-4 right-4 z-[150] max-w-sm animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="flex items-start gap-3 bg-zinc-900 border border-red-800/50 text-sm text-red-300 px-4 py-3 rounded-xl shadow-2xl shadow-black/50">
                        <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="flex-1 leading-snug">{playError}</p>
                        <button onClick={() => setPlayError(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}


            {!results && !loading && (
                <>
                    <RecentSearches onSearchClick={handleRecentSearchClick} />
                    {/* My Playlists — Restored */}
                    {playlists.length > 0 && (
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    <ListMusic className="h-5 w-5 text-primary" />
                                    My Playlists <span className="text-sm font-normal text-zinc-500 ml-2">({playlists.length}/8)</span>
                                </h2>
                                <button
                                    onClick={() => {
                                        try {
                                            createPlaylist('New Playlist');
                                        } catch (err) {
                                            showPlayError(err.message);
                                        }
                                    }}
                                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                                >
                                    <Plus className="h-3.5 w-3.5" /> New
                                </button>
                            </div>
                            
                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                {playlists.map((pl) => (
                                    <button
                                        key={pl.id}
                                        onClick={() => navigate(`/playlist/${pl.id}`)}
                                        className="flex-shrink-0 w-36 group focus:outline-none"
                                    >
                                        <div className="w-36 h-36 rounded-xl overflow-hidden bg-zinc-800 mb-2 shadow-md ring-1 ring-white/10 group-hover:ring-white/30 transition-all">
                                            {pl.songs.length > 0 ? (
                                                <div className="grid grid-cols-2 w-full h-full">
                                                    {pl.songs.slice(0, 4).map((s, i) => (
                                                        <div key={i} className="w-full h-full overflow-hidden">
                                                            <img src={s.img || s.image} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                    ))}
                                                    {pl.songs.length < 4 && [...Array(4 - pl.songs.length)].map((_, i) => (
                                                        <div key={i} className="bg-zinc-700 flex items-center justify-center">
                                                            <ListMusic className="h-4 w-4 text-zinc-500" />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ListMusic className="h-10 w-10 text-zinc-500" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm font-semibold truncate text-left group-hover:text-primary transition-colors">{pl.name}</p>
                                        <p className="text-xs text-muted-foreground text-left">{pl.songs.length} song{pl.songs.length !== 1 ? 's' : ''}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* HERO SECTION */}
                    <div style={{ padding: "10px 0 32px" }}>
                        <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
                            {/* Big type */}
                            <div className="shrink-0">
                                <div style={{ overflow: "hidden" }}>
                                    <div style={{
                                        fontFamily: "'Bebas Neue', sans-serif",
                                        fontSize: "clamp(60px, 8vw, 100px)", lineHeight: .87, letterSpacing: 3, color: "#fff",
                                        animation: heroIn ? "wordIn .7s cubic-bezier(.34,1.56,.64,1) .12s both" : "none",
                                    }}>PLAY</div>
                                </div>
                                <div style={{ overflow: "hidden" }}>
                                    <div style={{
                                        fontFamily: "'Bebas Neue', sans-serif",
                                        fontSize: "clamp(60px, 8vw, 100px)", lineHeight: .87, letterSpacing: 3,
                                        background: "linear-gradient(90deg, #d060e8, #7b2fff, #4a7aff)",
                                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                        animation: heroIn ? "wordIn .7s cubic-bezier(.34,1.56,.64,1) .28s both" : "none",
                                    }}>LOUD.</div>
                                </div>
                            </div>

                            {/* Trending panel via API */}
                            <div style={{
                                flex: 1, minWidth: 0, paddingTop: 6,
                                opacity: heroIn ? 1 : 0, transition: "opacity .6s ease .52s",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                    <span style={{ fontSize: 10, letterSpacing: 2.5, color: "#8a8a9e", fontWeight: 700 }}>
                                        TRENDING NOW
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                        <div style={{
                                            width: 7, height: 7, borderRadius: "50%", background: "#ff3333",
                                            animation: "pulseDot 1.6s ease-in-out infinite",
                                        }} />
                                        <span style={{ fontSize: 12, color: "#ff6666" }}>Live Global Charts</span>
                                    </div>
                                </div>

                                {/* 5 trending in a responsive grid */}
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    {trendingSongs.length > 0 ? trendingSongs.map((s, i) => (
                                        <AnimatedTrendingRow key={s.id || s.search_term} song={s} delay={580 + i * 65}
                                            active={currentPlayingId === s.search_term && isPlayerPlaying}
                                            onSelect={() => handlePlaySong(s)}
                                        />
                                    )) : (
                                        <div className="text-zinc-500 text-sm">Loading trending hits...</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Restored Component Render Block */}
                    <FeaturedCategories onCategoryClick={handleCategoryClick} />
                    <FocusSection onCategoryClick={handleCategoryClick} />
                    <TopGlobalArtists onViewAll={() => handleCategoryClick({
                        id: 'top_global_artists',
                        title: 'Top Global Artists',
                        description: 'The biggest stars on Volt Music'
                    })} />
                    <PopularAlbums onViewAll={() => handleCategoryClick({
                        id: 'popular_albums',
                        title: 'Popular Albums',
                        description: 'Top albums from around the world'
                        // No query — uses getCategorySongs('popular_albums') for curated results
                    })} />
                    <RecentHindiReleases onViewAll={() => handleCategoryClick({
                        id: 'recent_hindi_releases',
                        title: 'Recent Hindi Releases',
                        description: 'Latest Hindi tracks for you'
                        // No query — uses getCategorySongs('recent_hindi_releases')
                    })} />
                    <ChartsSection
                        onSongPlay={handlePlaySong}
                        onViewAll={() => handleCategoryClick({
                            id: 'charts_hindi',
                            title: 'Top Hindi Charts',
                            description: 'Most popular Hindi songs'
                            // No query — uses getCategorySongs('charts_hindi')
                        })}
                    />
                    <NoCopyrightSection onCategoryClick={handleCategoryClick} />
                </>
            )}

            {loading && !results && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            )}

            {results &&
                (!results.songs?.length && !results.albums?.length && !results.artists?.length) && !searchError && (
                    <div className="text-center py-12">
                        <div className="inline-block p-4 rounded-full bg-secondary mb-4">
                            <Music className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No results found</h3>
                        <p className="text-muted-foreground">Try adjusting your search terms</p>
                    </div>
                )}

            {/* Search error state */}
            {searchError && (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
                        <AlertCircle className="h-8 w-8 text-red-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-white">Search failed</h3>
                    <p className="text-zinc-400 mb-6 max-w-sm mx-auto">{searchError}</p>
                    <Button
                        onClick={() => { setSearchError(null); if (query) executeSearch(query, 0); }}
                        variant="outline"
                        className="gap-2"
                    >
                        <Loader2 className="h-4 w-4" />
                        Try again
                    </Button>
                </div>
            )}

            {results && (
                <>
                    {/* Back Button for All Search & Category Results */}
                    <div className="mb-4 mt-4">
                        <Button variant="ghost" className="text-white hover:text-[#00f3ff] transition-colors" onClick={handleBackToHome}>
                            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Home
                        </Button>
                    </div>

                    {/* Category Header with Controls */}
                    {currentCategory && (
                        <div className="mb-6">

                            {/* Category Title */}
                            <div className="text-left mb-4 px-2">
                                <h2 className="text-3xl font-bold mb-2 text-white">{currentCategory.title}</h2>
                                {currentCategory.description && <p className="text-zinc-400">{currentCategory.description}</p>}
                            </div>

                            {/* Play Controls - Only show if there are songs */}
                            {results.songs && results.songs.length > 0 && (
                                <div className="flex items-center justify-center gap-2 sm:gap-4 w-full max-w-xs sm:max-w-none mt-2 mb-6">
                                    <Button
                                        size="default"
                                        onClick={handlePlayAll}
                                        className="flex-1 sm:flex-none h-12 px-8 rounded-full bg-[#00f3ff] hover:bg-[#33f6ff] text-zinc-900 font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:shadow-[0_0_30px_rgba(0,243,255,0.5)] border-0 flex items-center gap-2"
                                    >
                                        <Play className="h-5 w-5 fill-current" />
                                        Play
                                    </Button>
                                    <Button
                                        size="default"
                                        variant="outline"
                                        onClick={handleShuffle}
                                        className="flex-1 sm:flex-none h-12 px-8 rounded-full border-2 border-white/20 text-white font-bold tracking-widest uppercase hover:bg-white/10 hover:border-white/40 transition-all flex items-center gap-2"
                                    >
                                        <Shuffle className="h-4 w-4" />
                                        Shuffle
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Songs Section - List in View All mode, hscroll for regular search */}
                    {/* Songs Section */}
                    {results.songs && results.songs.length > 0 && (() => {
                        const LIMIT = 5;
                        const songsToShow = currentCategory
                            ? results.songs
                            : (showAllSongs ? results.songs : results.songs.slice(0, LIMIT));
                        const hasMoreSongs = !currentCategory && results.songs.length > LIMIT;
                        return (
                            <section style={{ padding: "0 0 36px" }}>
                                <div className="flex items-end justify-between mb-3">
                                    <AnimatedSectionHeader
                                        title="Songs"
                                        sub={currentCategory ? `${results.songs.length} tracks` : undefined}
                                    />
                                    {hasMoreSongs && (
                                        <button
                                            onClick={() => setShowAllSongs(v => !v)}
                                            className="text-xs font-medium text-zinc-400 hover:text-white transition-colors mb-4 flex items-center gap-1"
                                        >
                                            {showAllSongs ? 'Show Less' : `View All (${results.songs.length})`}
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {songsToShow.map((song, idx) => (
                                        <SongListRow
                                            key={idx}
                                            song={{ ...song, img: song.image }}
                                            index={idx}
                                            delay={idx * 30}
                                            active={currentPlayingId === song.search_term && currentPlayingIndex === idx && isPlayerPlaying}
                                            paused={currentPlayingId === song.search_term && currentPlayingIndex === idx && !isPlayerPlaying}
                                            onSelect={() => handlePlaySong(song, idx)}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })()}

                    {/* Albums Section */}
                    {results.albums && results.albums.length > 0 && (() => {
                        const LIMIT = 5;
                        const albumsToShow = currentCategory
                            ? results.albums
                            : (showAllAlbums ? results.albums : results.albums.slice(0, LIMIT));
                        const hasMoreAlbums = !currentCategory && results.albums.length > LIMIT;
                        return (
                            <section style={{ padding: "0 0 36px" }}>
                                <div className="flex items-end justify-between mb-3">
                                    <AnimatedSectionHeader
                                        title="Albums"
                                        sub={currentCategory ? `${results.albums.length} albums` : undefined}
                                    />
                                    {hasMoreAlbums && (
                                        <button
                                            onClick={() => setShowAllAlbums(v => !v)}
                                            className="text-xs font-medium text-zinc-400 hover:text-white transition-colors mb-4 flex items-center gap-1"
                                        >
                                            {showAllAlbums ? 'Show Less' : `View All (${results.albums.length})`}
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 min-[500px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 md:gap-4">
                                    {albumsToShow.map((album, idx) => (
                                        <AnimatedAlbumCard
                                            key={idx}
                                            fluid={true}
                                            item={{ ...album, img: album.image }}
                                            delay={idx % 10 * 30}
                                            isPlaying={false}
                                            onPlay={() => {
                                                addRecentItem({
                                                    type: 'album',
                                                    id: album.album_id,
                                                    name: album.title,
                                                    title: album.title,
                                                    image: album.image,
                                                    subtitle: album.artist,
                                                });
                                                navigate(`/album/${album.album_id}`);
                                            }}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })()}

                    {/* Artists Section */}
                    {(!currentCategory || currentCategory.id === 'top_global_artists') && results.artists && results.artists.length > 0 && (() => {
                        const LIMIT = 5;
                        const artistsToShow = currentCategory
                            ? results.artists
                            : (showAllArtists ? results.artists : results.artists.slice(0, LIMIT));
                        const hasMoreArtists = !currentCategory && results.artists.length > LIMIT;
                        return (
                            <section style={{ padding: "0 0 36px" }}>
                                <div className="flex items-end justify-between mb-3">
                                    <AnimatedSectionHeader title="Artists" />
                                    {hasMoreArtists && (
                                        <button
                                            onClick={() => setShowAllArtists(v => !v)}
                                            className="text-xs font-medium text-zinc-400 hover:text-[#00f3ff] transition-colors mb-4"
                                        >
                                            {showAllArtists ? 'Show Less' : `View All (${results.artists.length})`}
                                        </button>
                                    )}
                                </div>
                                {/* Scroll mode: fix wrapper width so sm:w-[170px] circle doesn't clip */}
                                <div className={(showAllArtists || currentCategory)
                                    ? "grid grid-cols-2 min-[500px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 gap-y-8 mt-2"
                                    : "hscroll flex gap-4 overflow-x-auto pb-6 pt-2 custom-scrollbar touch-pan-x px-1"
                                }>
                                    {artistsToShow.map((artist, idx) => (
                                        <div
                                            key={idx}
                                            className={`cursor-pointer group flex justify-center ${
                                                !(showAllArtists || currentCategory)
                                                    ? 'flex-shrink-0 w-[150px] sm:w-[190px]'
                                                    : 'w-full'
                                            }`}
                                            onClick={() => {
                                                addRecentItem({
                                                    type: 'artist',
                                                    name: artist.name,
                                                    image: artist.image,
                                                    subtitle: artist.genre || 'Artist',
                                                });
                                                navigate(`/artist/${encodeURIComponent(artist.name)}`);
                                            }}
                                        >
                                            <div className="flex flex-col items-center w-full max-w-[170px]">
                                                <div className="w-[130px] h-[130px] sm:w-[170px] sm:h-[170px] rounded-full overflow-hidden relative shadow-lg ring-1 ring-white/10 group-hover:ring-white/20 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all duration-300 transform group-hover:-translate-y-2">
                                                    <ArtistImage
                                                        name={artist.name}
                                                        src={artist.image}
                                                        alt={artist.name}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 pointer-events-none"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                                </div>
                                                <div className="mt-3 sm:mt-4 text-center px-2 w-full">
                                                    <h3 className="text-white font-bold text-sm sm:text-base truncate group-hover:text-[#00f3ff] transition-colors w-full">{artist.name}</h3>
                                                    <p className="text-zinc-500 text-[10px] sm:text-xs mt-1 font-medium uppercase tracking-widest">{artist.genre || 'Artist'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })()}
                </>
            )}

        </div>
    );
}
