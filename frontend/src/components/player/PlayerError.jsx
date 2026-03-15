import { RefreshCw, AlertCircle, SkipForward, Wifi } from 'lucide-react';

/**
 * PlayerError — shown inside the StickyPlayer when audio fails to load or stream.
 * Props:
 *   song         — the song object that failed
 *   errorType    — 'stream' | 'network' | 'unknown'
 *   onRetry      — function to retry the current song
 *   onSkip       — function to skip to next song
 *   isRetrying   — boolean
 */
export function PlayerError({ song, errorType = 'unknown', onRetry, onSkip, isRetrying }) {
    const messages = {
        stream: {
            title: 'Stream unavailable',
            desc: 'The audio source returned an error. Try retrying or skipping.',
            icon: <AlertCircle className="h-5 w-5 text-red-400" />,
        },
        network: {
            title: 'Connection lost',
            desc: 'Check your internet connection and retry.',
            icon: <Wifi className="h-5 w-5 text-yellow-400" />,
        },
        unknown: {
            title: "Couldn't play this song",
            desc: 'An unexpected error occurred. Try retrying or skip to the next track.',
            icon: <AlertCircle className="h-5 w-5 text-red-400" />,
        },
    };

    const { title, desc, icon } = messages[errorType] || messages.unknown;

    return (
        <div className="flex items-center gap-3 px-4 py-2 w-full">
            {/* Album art with error overlay */}
            <div className="relative w-10 h-10 md:w-14 md:h-14 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                {song?.img ? (
                    <img src={song.img} alt={song.title} className="w-full h-full object-cover opacity-30" />
                ) : (
                    <div className="w-full h-full bg-zinc-800" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                    {icon}
                </div>
            </div>

            {/* Error message */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{song?.title || 'Unknown song'}</p>
                <p className="text-xs text-red-400 font-medium">{title}</p>
                <p className="text-[11px] text-zinc-500 hidden md:block">{desc}</p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all disabled:opacity-50 active:scale-95"
                    title="Retry this song"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isRetrying ? 'Retrying...' : 'Retry'}</span>
                </button>
                {onSkip && (
                    <button
                        onClick={onSkip}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all active:scale-95"
                        title="Skip to next song"
                    >
                        <SkipForward className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Skip</span>
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * PlayerLoadingState — shown while the stream URL is being resolved.
 */
export function PlayerLoadingState({ song }) {
    return (
        <div className="flex items-center gap-3 px-4 py-2 w-full animate-pulse">
            <div className="relative w-10 h-10 md:w-14 md:h-14 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                {song?.img && (
                    <img src={song.img} alt="" className="w-full h-full object-cover opacity-40" />
                )}
                {/* Spinning ring */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full border-2 border-zinc-600 border-t-green-400 animate-spin" />
                </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-3.5 bg-zinc-700 rounded w-36" />
                <div className="h-3 bg-zinc-800 rounded w-24" />
            </div>
            <div className="text-xs text-zinc-500 shrink-0 hidden sm:block">Loading stream…</div>
        </div>
    );
}
