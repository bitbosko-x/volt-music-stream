import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    X, ChevronDown, SkipBack, SkipForward, Volume2, VolumeX,
    RotateCcw, Shuffle, Zap, Play, Pause, ListMusic, Maximize2, MoreHorizontal,
    ListPlus, CheckCircle2, Disc
} from 'lucide-react';
import { getAudioStream, getVideoPreview } from '@/lib/api';
import { MusicBars } from './MusicBars';
import { usePlaylist } from '@/context/PlaylistContext';
import { AnimatedLogo } from '@/components/AnimatedLogo';
import { PlayerError, PlayerLoadingState } from './PlayerError';

export function StickyPlayer() {
    const [player, setPlayer] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [videoUrl, setVideoUrl] = useState(null);
    const [volume, setVolume] = useState(1);
    const [analyser, setAnalyser] = useState(null);
    const [streamError, setStreamError] = useState(null); // { type, song }
    const [streamLoading, setStreamLoading] = useState(false);
    const videoRef = useRef(null);
    const bgVideoRef = useRef(null); // Ref for background video
    const audioRef = useRef(null);
    const audioCtxRef = useRef(null);
    const sourceRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { openAddToPlaylist, isSongInAnyPlaylist } = usePlaylist();

    // Lock body scroll when expanded
    useEffect(() => {
        if (isExpanded) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isExpanded]);

    // Sync background video with play state
    useEffect(() => {
        if (bgVideoRef.current) {
            if (isPlaying) {
                bgVideoRef.current.play().catch(e => console.log("Bg video play error", e));
            } else {
                bgVideoRef.current.pause();
            }
        }
    }, [isPlaying, isExpanded, videoUrl]);

    // Auto-collapse on navigation
    useEffect(() => {
        setIsExpanded(false);
    }, [location.pathname]);

    // Handle Back Button for Expanded Player
    useEffect(() => {
        if (isExpanded) {
            window.history.pushState({ expanded: true }, '');
            const handlePopState = (event) => {
                event.preventDefault();
                setIsExpanded(false);
            };
            window.addEventListener('popstate', handlePopState);
            return () => {
                window.removeEventListener('popstate', handlePopState);
                if (window.history.state?.expanded) {
                    window.history.back();
                }
            };
        }
    }, [isExpanded]);

    useEffect(() => {
        if (!player) return;
        const fetchVideo = async () => {
            setVideoUrl(null);
            try {
                const query = `${player.title} ${player.artist || ''}`;
                const url = await getVideoPreview(query);
                if (url) setVideoUrl(url);
            } catch (error) {
                console.error("Failed to fetch video preview", error);
            }
        };
        fetchVideo();
    }, [player]);

    // Sync Video with Audio
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (isPlaying) {
            video.play().catch(() => { });
        } else {
            video.pause();
        }
    }, [isPlaying, videoUrl, isExpanded]);

    useEffect(() => {
        const loadPlayer = () => {
            const saved = localStorage.getItem('currentTrack');
            const savedQueue = localStorage.getItem('queue');
            const savedIndex = localStorage.getItem('currentIndex');
            if (saved) setPlayer(JSON.parse(saved));
            if (savedQueue) setQueue(JSON.parse(savedQueue));
            if (savedIndex) setCurrentIndex(parseInt(savedIndex));
        };
        loadPlayer();

        const handlePlayerUpdate = async (e) => {
            const trackData = e.detail;
            if (!trackData) {
                // Player closed
                setPlayer(null);
                return;
            }

            // If stream_url is already resolved (e.g. queue navigation), use it directly
            if (trackData.stream_url) {
                setPlayer(trackData);
                localStorage.setItem('currentTrack', JSON.stringify(trackData));
                if (trackData.queue) {
                    setQueue(trackData.queue);
                    setCurrentIndex(trackData.currentIndex || 0);
                    localStorage.setItem('queue', JSON.stringify(trackData.queue));
                    localStorage.setItem('currentIndex', trackData.currentIndex || 0);
                } else {
                    setQueue([]);
                    setCurrentIndex(0);
                    localStorage.removeItem('queue');
                    localStorage.removeItem('currentIndex');
                }
                return;
            }

            // No stream_url yet — show player immediately in loading state, then fetch
            const metaOnly = { ...trackData, stream_url: null };
            setPlayer(metaOnly);
            setStreamError(null);
            setStreamLoading(true);
            if (trackData.queue) {
                setQueue(trackData.queue);
                setCurrentIndex(trackData.currentIndex || 0);
                localStorage.setItem('queue', JSON.stringify(trackData.queue));
                localStorage.setItem('currentIndex', trackData.currentIndex || 0);
            } else {
                setQueue([]);
                setCurrentIndex(0);
                localStorage.removeItem('queue');
                localStorage.removeItem('currentIndex');
            }

            try {
                const { stream_url, source } = await getAudioStream(trackData.search_term, trackData.artist);
                const fullTrack = { ...trackData, stream_url, source };
                setPlayer(fullTrack);
                localStorage.setItem('currentTrack', JSON.stringify(fullTrack));
                localStorage.setItem('currentTime', 0);
            } catch (error) {
                console.error('Failed to resolve stream:', error);
                const errorType = !navigator.onLine ? 'network' : 'stream';
                setStreamError({ type: errorType, song: trackData });
                setPlayer(null);
            } finally {
                setStreamLoading(false);
            }
        };

        window.addEventListener('playTrack', handlePlayerUpdate);
        window.addEventListener('pageshow', loadPlayer);
        return () => {
            window.removeEventListener('playTrack', handlePlayerUpdate);
            window.removeEventListener('pageshow', loadPlayer);
        };
    }, []);

    // Restore playback position
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !player) return;
        const handleLoadedMetadata = () => {
            const savedTime = localStorage.getItem('currentTime');
            const wasPlaying = localStorage.getItem('wasPlaying') === 'true';
            if (savedTime) {
                const time = parseFloat(savedTime);
                audio.currentTime = time;
                setCurrentTime(time);
                if (wasPlaying) audio.play().catch(() => { });
            }
        };
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        return () => audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }, [player]);

    // Volume Persist
    useEffect(() => {
        const savedVolume = localStorage.getItem('volume');
        if (savedVolume) {
            const vol = parseFloat(savedVolume);
            setVolume(vol);
            if (audioRef.current) audioRef.current.volume = vol;
        }
    }, []);

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (audioRef.current) audioRef.current.volume = newVolume;
        localStorage.setItem('volume', newVolume);
    };

    const toggleMute = () => {
        if (volume > 0) {
            localStorage.setItem('lastVolume', volume);
            setVolume(0);
            if (audioRef.current) audioRef.current.volume = 0;
        } else {
            const lastVolume = parseFloat(localStorage.getItem('lastVolume') || '1');
            setVolume(lastVolume);
            if (audioRef.current) audioRef.current.volume = lastVolume;
        }
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => {
            setCurrentTime(audio.currentTime);
            if (player) {
                localStorage.setItem('currentTime', audio.currentTime);
                localStorage.setItem('wasPlaying', !audio.paused);
            }
        };

        const updateDuration = () => setDuration(audio.duration);

        const handleEnded = () => {
            if (queue.length > 0 && currentIndex < queue.length - 1) {
                playNext();
            }
        };

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('play', () => setIsPlaying(true));
        audio.addEventListener('pause', () => setIsPlaying(false));
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [player, queue, currentIndex]);

    // Keyboard controls
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                if (audioRef.current) {
                    audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
                }
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    const handleClose = () => {
        audioRef.current.pause();
        setPlayer(null);
        setIsExpanded(false);
        setQueue([]);
        setCurrentIndex(0);
        localStorage.removeItem('currentTrack');
        localStorage.removeItem('currentTime');
        localStorage.removeItem('wasPlaying');
        localStorage.removeItem('queue');
        localStorage.removeItem('currentIndex');
        window.dispatchEvent(new CustomEvent('playTrack', { detail: null }));
    };

    const handleArtistClick = (artistName) => {
        if (artistName) {
            navigate(`/artist/${encodeURIComponent(artistName)}`);
            setIsExpanded(false);
        }
    };

    const handleAlbumClick = () => {
        if (player?.album_id) {
            navigate(`/album/${player.album_id}`);
            setIsExpanded(false);
        }
    };

    const parseArtists = (artistString) => {
        if (!artistString) return [];
        return artistString
            .split(/,|&|feat\.|ft\.|featuring/i)
            .map(artist => artist.trim())
            .filter(artist => artist.length > 0);
    };

    const artists = player ? parseArtists(player.artist) : [];

    const handleSeek = (e) => {
        const progressBar = e.currentTarget;
        const clickX = e.clientX - progressBar.getBoundingClientRect().left;
        const width = progressBar.offsetWidth;
        const seekTime = (clickX / width) * duration;
        if (audioRef.current) {
            audioRef.current.currentTime = seekTime;
            setCurrentTime(seekTime);
        }
    };

    const playTrackAtIndex = useCallback(async (index) => {
        if (index < 0 || index >= queue.length) return;
        const song = queue[index];
        setStreamError(null);
        setStreamLoading(true);
        try {
            const { stream_url, source } = await getAudioStream(song.search_term, song.artist);
            const trackData = {
                title: song.title,
                artist: song.artist,
                img: song.img || song.image,
                album: song.album || null,
                album_id: song.album_id || null,
                search_term: song.search_term,
                stream_url,
                source,
                queue: queue,
                currentIndex: index,
            };
            setPlayer(trackData);
            setCurrentIndex(index);
            localStorage.setItem('currentTrack', JSON.stringify(trackData));
            localStorage.setItem('currentIndex', index);
            localStorage.setItem('currentTime', 0);
            window.dispatchEvent(new CustomEvent('playTrack', { detail: trackData }));
        } catch (error) {
            console.error('Failed to play song:', error);
            const errorType = !navigator.onLine ? 'network' : 'stream';
            setStreamError({ type: errorType, song });
        } finally {
            setStreamLoading(false);
        }
    }, [queue]);

    const playNext = () => playTrackAtIndex(currentIndex + 1);
    const playPrevious = () => playTrackAtIndex(currentIndex - 1);
    const playFromQueue = (song, index) => playTrackAtIndex(index);

    const restartSong = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            if (!isPlaying) {
                audioRef.current.play().catch(e => console.error(e));
                setIsPlaying(true);
            }
        }
    };

    const togglePlay = () => {
        if (audioRef.current) {
            audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
        }
    };

    useEffect(() => {
        const handleToggleGlobalPlay = () => togglePlay();
        window.addEventListener('toggleGlobalPlay', handleToggleGlobalPlay);
        return () => window.removeEventListener('toggleGlobalPlay', handleToggleGlobalPlay);
    }, []);

    const formatTime = (seconds) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!player) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const upNext = queue.slice(currentIndex + 1);

    return (
        <>
            <audio
                ref={audioRef}
                src={player.stream_url}
                autoPlay
                crossOrigin="anonymous"
                onPlay={() => {
                    setIsPlaying(true);
                    // Init Audio Context on first user interaction/play
                    if (!audioCtxRef.current && audioRef.current) {
                        try {
                            const AudioContext = window.AudioContext || window.webkitAudioContext;
                            const ctx = new AudioContext();
                            const analyserNode = ctx.createAnalyser();
                            analyserNode.fftSize = 2048;

                            const source = ctx.createMediaElementSource(audioRef.current);
                            source.connect(analyserNode);
                            analyserNode.connect(ctx.destination);

                            audioCtxRef.current = ctx;
                            sourceRef.current = source;
                            setAnalyser(analyserNode);
                        } catch (e) {
                            console.error("Audio Context Init Failed (possibly CORS)", e);
                        }
                    } else if (audioCtxRef.current?.state === 'suspended') {
                        audioCtxRef.current.resume();
                    }
                }}
                className="hidden"
            />

            {/* EXPANDED VIEW */}
            {isExpanded && (
                <div className="fixed inset-0 z-[120] bg-[#09090b] text-white flex flex-col font-sans animate-in fade-in duration-200 h-[100dvh] overflow-hidden">

                    {/* Global Blurred Background for Glassmorphism */}
                    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                        {videoUrl ? (
                            <video
                                ref={bgVideoRef} // Attach ref here
                                src={videoUrl}
                                muted
                                loop
                                playsInline
                                className="w-full h-full object-cover opacity-90 blur-[0.5px] scale-110"
                            />
                        ) : (
                            <img
                                src={player.img || player.image || player.cover}
                                alt="Background"
                                className="w-full h-full object-cover opacity-50 blur-[60px] scale-150 saturate-[1.5]"
                            />
                        )}
                        <div className={`absolute inset-0 ${videoUrl ? 'bg-black/20' : 'bg-[#09090b]/50'} backdrop-blur-sm`} />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent" />
                    </div>

                    {/* Top Bar */}

                    <header className="flex items-center justify-between px-4 py-4 md:px-6 md:py-5 border-b border-white/5 bg-[#09090b]/95 backdrop-blur-sm z-30">
                        <button
                            className="flex items-center gap-2 sm:gap-4 hover:scale-105 transition-all duration-300 group shrink-0"
                            onClick={() => { navigate('/'); setIsExpanded(false); }}
                        >
                            <AnimatedLogo className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12" isPlaying={isExpanded && isPlaying} />
                            <span className="text-lg sm:text-2xl md:text-3xl tracking-widest text-[#f5f5f5] whitespace-nowrap pt-1" style={{
                                fontFamily: '"Monoton", sans-serif',
                                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                                lineHeight: 1
                            }}>
                                Volt Music
                            </span>
                        </button>
                        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 bg-zinc-900/80 backdrop-blur-md px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-white/10 shadow-inner">
                                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${player.source === 'saavn' ? 'bg-[#b5f000]' : 'bg-yellow-500'} shadow-[0_0_8px_rgba(181,240,0,0.5)] animate-pulse-slow`} />
                                <span className={`text-[9px] sm:text-xs font-bold tracking-wider uppercase ${player.source === 'saavn' ? 'text-[#b5f000]' : 'text-yellow-500'}`}>
                                    {player.source === 'saavn' ? '320kbps (HQ)' : '128kbps M4A'}
                                </span>
                            </div>
                        </div>
                    </header>

                    {/* Main Content */}
                    <main className="flex-1 flex overflow-hidden min-h-0">
                        {/* Center Visuals */}
                        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 lg:p-12 relative bg-gradient-to-b from-zinc-900/10 to-black/50 overflow-hidden">
                            <div
                                className="relative w-[clamp(150px,60vw,350px)] sm:w-full sm:max-w-sm max-h-[35vh] md:max-h-none rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] ring-1 ring-white/10 transition-transform duration-500 hover:scale-105 mt-2 md:mt-0 mx-auto shrink-1 group"
                                style={{ aspectRatio: '1/1' }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="absolute -inset-4 bg-[#00f3ff] blur-[100px] opacity-20 group-hover:opacity-40 transition-opacity duration-700 -z-10" />
                                <img
                                    src={player.img}
                                    alt={player.title}
                                    className={`w-full h-full object-contain transition-opacity duration-300 relative z-0 ${streamLoading ? 'opacity-40' : 'opacity-100'}`}
                                />
                                {streamLoading && (
                                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-[2px]">
                                        <div className="w-12 h-12 rounded-full border-[3px] border-[#00f3ff]/30 border-t-[#00f3ff] animate-spin shadow-[0_0_15px_rgba(181,240,0,0.5)]" />
                                        <span className="text-xs font-bold text-[#00f3ff] tracking-widest uppercase animate-pulse">Loading…</span>
                                    </div>
                                )}
                            </div>

                            {/* Large Title */}
                            <div className="mt-4 md:mt-8 text-center max-w-2xl px-4 shrink-0">
                                <h1 className="text-xl md:text-3xl lg:text-5xl font-extrabold tracking-tight text-white mb-2 leading-tight drop-shadow-2xl">
                                    {player.title}
                                </h1>
                                <div className="text-sm sm:text-lg md:text-xl 2xl:text-2xl 3xl:text-3xl text-zinc-400 font-semibold tracking-wide flex flex-wrap justify-center gap-1 mt-1 sm:mt-0">
                                    {(player.artist || '').split(/,|&|feat\.|ft\.|featuring/i).map((part, i, arr) => {
                                        const artistName = part.trim();
                                        if (!artistName) return null;
                                        return (
                                            <span key={i} className="flex items-center">
                                                <span
                                                    className="hover:text-[#00f3ff] hover:drop-shadow-[0_0_8px_rgba(181,240,0,0.5)] cursor-pointer transition-all duration-300"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleArtistClick(artistName);
                                                    }}
                                                >
                                                    {artistName}
                                                </span>
                                                {i < arr.length - 1 && <span className="text-zinc-600 ml-1">,</span>}
                                            </span>
                                        );
                                    })}
                                </div>
                                {player.album && player.album_id && (
                                    <button
                                        onClick={handleAlbumClick}
                                        className="mt-2 text-sm 2xl:text-base 3xl:text-lg text-zinc-500 hover:text-white transition-colors duration-300 flex items-center justify-center gap-2 mx-auto bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-full border border-white/5"
                                    >
                                        <Disc className="h-4 w-4" /> {player.album}
                                    </button>
                                )}
                            </div>

                            {/* Up Next Playlist — shown below artist, hidden on lg (sidebar handles it) */}
                            {upNext.length > 0 && (
                                <div className="lg:hidden w-full max-w-sm px-4 mt-4 shrink-0">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#00f3ff] mb-2 text-center drop-shadow-[0_0_5px_rgba(181,240,0,0.3)]">Up Next</p>
                                    <div className="space-y-1.5">
                                        {/* Mobile: max 1 song shown under 412px, 2 songs up to sm, 3 on sm+ */}
                                        {upNext.slice(0, 3).map((song, idx) => (
                                            <div
                                                key={idx}
                                                className={`group items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 cursor-pointer backdrop-blur-md border
                                                    ${idx === 0 ? 'bg-white/10 border-white/20 shadow-lg' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'}
                                                    ${idx >= 2 ? 'hidden sm:flex' : idx === 1 ? 'hidden min-[412px]:flex' : 'flex'}
                                                `}
                                                onClick={() => playFromQueue(song, currentIndex + 1 + idx)}
                                            >
                                                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-800 shadow-md">
                                                    <img
                                                        src={song.img || song.image}
                                                        alt={song.title}
                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-zinc-200 group-hover:text-white truncate transition-colors leading-tight">
                                                        {song.title}
                                                    </p>
                                                    <p className="text-xs font-medium text-zinc-500 group-hover:text-zinc-400 truncate transition-colors mt-0.5">
                                                        {song.artist}
                                                    </p>
                                                </div>
                                                {idx === 0 && (
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#00f3ff] animate-pulse-slow" />
                                                        <span className="text-[10px] font-bold text-[#00f3ff] uppercase tracking-wider shrink-0">Next</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Audio Visualizer */}
                            <div className="mt-auto w-full px-8 pb-0">
                                <MusicBars isPlaying={isPlaying} analyser={analyser} />
                            </div>
                        </div>

                        {/* Right Sidebar: Queue */}
                        <div className="hidden lg:flex w-96 bg-black/40 backdrop-blur-xl border-l border-white/10 flex-col z-20 shadow-2xl">
                            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                                <h3 className="text-xs font-bold text-[#00f3ff] uppercase tracking-widest flex items-center gap-2 drop-shadow-[0_0_8px_rgba(181,240,0,0.3)]">
                                    <ListMusic className="h-4 w-4" />
                                    Up Next
                                </h3>
                                <span className="text-xs font-medium text-zinc-500 bg-black/50 px-2 py-1 rounded-full">{upNext.length} Tracks</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                                {upNext.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-3">
                                        <ListMusic className="h-12 w-12 opacity-20" />
                                        <p className="text-sm font-medium">Queue is empty</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {upNext.map((song, idx) => (
                                            <div
                                                key={idx}
                                                className="group flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10 transition-all duration-300 cursor-pointer"
                                                onClick={() => playFromQueue(song, currentIndex + 1 + idx)}
                                            >
                                                <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-zinc-800 shadow-md">
                                                    <img
                                                        src={song.img || song.image}
                                                        alt={song.title}
                                                        className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-zinc-300 group-hover:text-white truncate transition-colors leading-snug">
                                                        {song.title}
                                                    </p>
                                                    <p className="text-xs font-semibold text-zinc-500 group-hover:text-zinc-400 truncate transition-colors">
                                                        {song.artist}
                                                    </p>
                                                </div>
                                                {/* Play indicator on hover or next */}
                                                <div className="w-8 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="w-6 h-6 rounded-full bg-[#00f3ff]/10 flex items-center justify-center">
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#00f3ff">
                                                            <polygon points="7,3 21,12 7,21" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </main>

                    {/* Bottom Controls Bar */}
                    <footer className="bg-[#121212] border-t border-white/5 flex flex-col md:grid md:grid-cols-[1fr_2fr_1fr] items-center px-4 md:px-6 py-4 md:py-0 md:h-24 gap-4 md:gap-0 z-40 relative">
                        {/* Current Track Info (Hidden on Mobile since big art is visible) */}
                        <div className="hidden md:flex items-center gap-4 min-w-0">
                            <img src={player.img} alt={player.title} className="w-14 h-14 rounded shadow-lg object-cover ring-1 ring-white/10" />
                            <div className="min-w-0">
                                <h4 className="text-sm font-semibold text-white/90 truncate hover:underline cursor-pointer">{player.title}</h4>
                                <div className="text-xs text-zinc-500 truncate flex items-center gap-1">
                                    {(player.artist || '').split(/,|&|feat\.|ft\.|featuring/i).map((part, i, arr) => {
                                        const artistName = part.trim();
                                        if (!artistName) return null;
                                        return (
                                            <span key={i} className="flex items-center">
                                                <span
                                                    className="hover:text-zinc-300 hover:underline cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleArtistClick(artistName);
                                                    }}
                                                >
                                                    {artistName}
                                                </span>
                                                {i < arr.length - 1 && <span className="mr-1">,</span>}
                                            </span>
                                        );
                                    })}
                                </div>
                                {player.album && player.album_id && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleAlbumClick(); }}
                                        className="text-xs text-zinc-600 hover:text-zinc-300 hover:underline transition-colors truncate max-w-full text-left"
                                    >
                                        💿 {player.album}
                                    </button>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`hidden xl:flex transition-colors ${player && isSongInAnyPlaylist(player)
                                    ? 'text-green-500 hover:text-green-400'
                                    : 'text-zinc-600 hover:text-white'
                                    }`}
                                title={player && isSongInAnyPlaylist(player) ? 'In a playlist' : 'Add to playlist'}
                                onClick={() => player && openAddToPlaylist(player)}
                            >
                                {player && isSongInAnyPlaylist(player)
                                    ? <CheckCircle2 className="h-5 w-5 fill-green-500/20" />
                                    : <ListPlus className="h-5 w-5" />}
                            </Button>
                        </div>

                        {/* Player Controls */}
                        <div className="flex flex-col items-center justify-center gap-2 w-full max-w-xl mx-auto">
                            <div className="flex items-center gap-6">
                                <button
                                    className="text-zinc-400 hover:text-white transition-colors"
                                    title="Start Over"
                                    onClick={restartSong}
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </button>
                                <button
                                    className="text-zinc-300 hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-zinc-300"
                                    onClick={playPrevious}
                                    disabled={currentIndex === 0}
                                >
                                    <SkipBack className="h-5 w-5 fill-current" />
                                </button>
                                <button
                                    onClick={togglePlay}
                                    disabled={streamLoading}
                                    className="w-12 h-12 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 transition active:scale-95 text-black shadow-lg shadow-white/10 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {streamLoading ? (
                                        <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                                    ) : isPlaying ? (
                                        <Pause className="h-6 w-6 md:h-5 md:w-5 fill-current" />
                                    ) : (
                                        <Play className="h-6 w-6 md:h-5 md:w-5 fill-current ml-0.5" />
                                    )}
                                </button>
                                <button
                                    className="text-zinc-300 hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-zinc-300"
                                    onClick={playNext}
                                    disabled={queue.length === 0 || currentIndex >= queue.length - 1}
                                >
                                    <SkipForward className="h-5 w-5 fill-current" />
                                </button>
                                <button
                                    className="text-zinc-400 hover:text-white transition-colors"
                                    title="Shuffle Queue"
                                    onClick={() => {
                                        if (queue.length > 1) {
                                            const current = queue[currentIndex];
                                            const upcoming = queue.slice(currentIndex + 1);
                                            for (let i = upcoming.length - 1; i > 0; i--) {
                                                const j = Math.floor(Math.random() * (i + 1));
                                                [upcoming[i], upcoming[j]] = [upcoming[j], upcoming[i]];
                                            }
                                            const newQueue = [...queue.slice(0, currentIndex), current, ...upcoming];
                                            setQueue(newQueue);
                                            localStorage.setItem('queue', JSON.stringify(newQueue));
                                        }
                                    }}
                                >
                                    <Shuffle className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Progress */}
                            <div className="w-[90%] md:w-full mx-auto flex items-center gap-3 text-[10px] font-medium font-mono text-zinc-500">
                                <span className="w-8 text-right">{formatTime(currentTime)}</span>
                                <div
                                    className="flex-1 h-1 bg-zinc-800 rounded-full cursor-pointer relative group py-1"
                                    onClick={handleSeek}
                                >
                                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-zinc-800 rounded-full pointer-events-none" />
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-zinc-300 group-hover:bg-green-500 rounded-full pointer-events-none"
                                        style={{ width: `${progress}%` }}
                                    />
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                        style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
                                    />
                                </div>
                                <span className="w-8">{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Volume & Tools */}
                        <div className="flex items-center justify-end gap-3 min-w-0">
                            <div className="flex items-center gap-2 group">
                                <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
                                    {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                </button>
                                <div className="hidden md:block w-20 lg:w-28 h-1.5 bg-zinc-800 rounded-full relative cursor-pointer group-hover:bg-zinc-700 transition-colors">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={volume}
                                        onChange={handleVolumeChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div
                                        className="absolute top-0 left-0 h-full bg-white group-hover:bg-[#00f3ff] rounded-full pointer-events-none transition-colors"
                                        style={{ width: `${volume * 100}%` }}
                                    />
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                        style={{ left: `${volume * 100}%`, transform: 'translate(-50%, -50%)' }}
                                    />
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)} className="rounded-full hover:bg-white/10 text-zinc-400 hover:text-white">
                                <ChevronDown className="h-6 w-6" />
                            </Button>
                        </div>
                    </footer>
                </div>
            )}

            {/* MINIMIZED BAR (Logic for when !isExpanded) */}
            {!isExpanded && (
                <div className="fixed bottom-0 left-0 right-0 z-[100]">
                    {/* Stream loading skeleton */}
                    {streamLoading && (
                        <div className="bg-gradient-to-r from-slate-900/98 via-purple-900/98 to-slate-900/98 backdrop-blur-xl border-t border-purple-500/20 px-2 py-1">
                            <PlayerLoadingState song={player} />
                        </div>
                    )}
                    {/* Stream error bar */}
                    {streamError && !streamLoading && (
                        <div className="bg-zinc-950/95 backdrop-blur-xl border-t border-red-900/40">
                            <PlayerError
                                song={streamError.song}
                                errorType={streamError.type}
                                onRetry={() => {
                                    const idx = queue.findIndex(s => s.search_term === streamError.song?.search_term);
                                    playTrackAtIndex(idx >= 0 ? idx : currentIndex);
                                }}
                                onSkip={currentIndex < queue.length - 1 ? () => playTrackAtIndex(currentIndex + 1) : null}
                                isRetrying={streamLoading}
                            />
                        </div>
                    )}
                    <div className="bg-gradient-to-r from-slate-900/98 via-purple-900/98 to-slate-900/98 backdrop-blur-xl border-t border-purple-500/20">
                        {/* Thin Progress Bar */}
                        <div
                            className="h-1 bg-white/5 cursor-pointer group relative overflow-hidden"
                            onClick={handleSeek}
                        >
                            <div
                                className="h-full bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        <div className="max-w-screen-2xl mx-auto flex items-center gap-2 px-3 py-4 md:gap-4 md:px-5 md:py-4 cursor-pointer" onClick={(e) => {
                            // Only expand if clicking the general area, not buttons
                            if (e.target === e.currentTarget || e.target.closest('.flex-1')) setIsExpanded(true);
                        }}>
                            {/* Album Art + Info */}
                            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                                <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden shrink-0 shadow-lg ring-1 ring-white/10">
                                    <img src={player.img} alt={player.title} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate text-white text-sm md:text-base">{player.title}</p>
                                    <div className="truncate w-full text-xs text-purple-200/80 flex items-center gap-1">
                                        {(player.artist || '').split(/,|&|feat\.|ft\.|featuring/i).map((part, i, arr) => {
                                            const artistName = part.trim();
                                            if (!artistName) return null;
                                            return (
                                                <span key={i} className="flex items-center">
                                                    <span
                                                        className="hover:text-white hover:underline cursor-pointer transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleArtistClick(artistName);
                                                        }}
                                                    >
                                                        {artistName}
                                                    </span>
                                                    {i < arr.length - 1 && <span className="mr-1">,</span>}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Center Controls */}
                            <div className="flex items-center gap-1 md:gap-2 shrink-0">
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); restartSong(); }} className="h-8 w-8 md:h-9 md:w-9 text-purple-200 hover:bg-white/10 hover:text-white disabled:opacity-30">
                                    <RotateCcw className="h-4 w-4 md:h-5 md:w-5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); playPrevious(); }} disabled={currentIndex === 0} className="h-8 w-8 md:h-9 md:w-9 text-purple-200 hover:bg-white/10 hover:text-white disabled:opacity-30">
                                    <SkipBack className="h-4 w-4 md:h-5 md:w-5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); togglePlay(); }} disabled={streamLoading} className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 disabled:opacity-70">
                                    {streamLoading
                                        ? <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                        : isPlaying ? <Pause className="h-5 w-5 md:h-6 md:w-6 fill-current" /> : <Play className="h-5 w-5 md:h-6 md:w-6 fill-current ml-0.5" />}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); playNext(); }} disabled={queue.length === 0 || currentIndex >= queue.length - 1} className="h-8 w-8 md:h-9 md:w-9 text-purple-200 hover:bg-white/10 hover:text-white disabled:opacity-30">
                                    <SkipForward className="h-4 w-4 md:h-5 md:w-5" />
                                </Button>
                            </div>

                            {/* Right: Volume & Tools */}
                            <div className="flex items-center justify-end shrink-0 gap-1 md:gap-3">
                                <div className="hidden md:flex items-center gap-2 group">
                                    <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-purple-200 hover:text-white transition-colors">
                                        {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                    </button>
                                    <div className="w-20 lg:w-24 h-1.5 bg-white/10 rounded-full relative cursor-pointer group-hover:bg-white/20 transition-colors">
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={volume}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={handleVolumeChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <div
                                            className="absolute top-0 left-0 h-full bg-white group-hover:bg-[#00f3ff] rounded-full pointer-events-none transition-colors"
                                            style={{ width: `${volume * 100}%` }}
                                        />
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                            style={{ left: `${volume * 100}%`, transform: 'translate(-50%, -50%)' }}
                                        />
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => { e.stopPropagation(); player && openAddToPlaylist(player); }}
                                    className={`h-8 w-8 md:h-9 md:w-9 transition-colors ${player && isSongInAnyPlaylist(player)
                                        ? 'text-green-400 hover:text-green-300 hover:bg-white/10'
                                        : 'text-purple-200 hover:bg-white/10 hover:text-white'
                                        }`}
                                    title={player && isSongInAnyPlaylist(player) ? 'In a playlist' : 'Add to playlist'}
                                >
                                    {player && isSongInAnyPlaylist(player)
                                        ? <CheckCircle2 className="h-4 w-4 fill-green-400/20" />
                                        : <ListPlus className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }} className="h-8 w-8 md:h-9 md:w-9 text-purple-200 hover:bg-white/10">
                                    <Maximize2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleClose(); }} className="h-8 w-8 md:h-9 md:w-9 text-purple-200/60 hover:bg-red-500/20 hover:text-red-300">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
