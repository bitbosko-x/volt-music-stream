import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * Full-page "backend offline" state — shown when the API is completely unreachable.
 */
export function BackendOfflinePage({ onRetry, isRetrying }) {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
            {/* Background grid texture */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzI3MjcyNyIgb3BhY2l0eT0iMC40IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40 pointer-events-none" />

            <div className="relative z-10 text-center max-w-md w-full">
                {/* Animated icon */}
                <div className="relative mx-auto mb-8 w-28 h-28">
                    <div className="absolute inset-0 rounded-full bg-red-500/10 animate-ping" />
                    <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-zinc-900 border border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
                        <WifiOff className="h-12 w-12 text-red-400" strokeWidth={1.5} />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                    Backend Offline
                </h1>
                <p className="text-zinc-400 text-base mb-8">
                    Volt Music can't reach its server right now.
                </p>

                {/* Retry button */}
                <button
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="group flex items-center gap-2 mx-auto px-6 py-3 bg-green-500 hover:bg-green-400 disabled:bg-zinc-700 disabled:text-zinc-400 text-black font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-green-500/20 hover:shadow-green-400/30 active:scale-95"
                >
                    <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    {isRetrying ? 'Checking...' : 'Retry Connection'}
                </button>
            </div>
        </div>
    );
}

/**
 * Non-blocking top banner — for when backend is online but degraded,
 * or just came back online after being offline.
 */
export function BackendErrorBanner({ message, onRetry, isRetrying, onDismiss }) {
    return (
        <div className="fixed top-0 left-0 right-0 z-[200] animate-in slide-in-from-top duration-300">
            <div className="bg-red-950/95 backdrop-blur-md border-b border-red-800/50 px-4 py-3 flex items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
                    <p className="text-sm text-red-200 truncate">
                        {message || 'Could not reach the backend server.'}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={onRetry}
                        disabled={isRetrying}
                        className="flex items-center gap-1.5 text-xs font-medium text-red-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-red-800/50"
                    >
                        <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                        Retry
                    </button>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="text-red-500 hover:text-red-300 transition-colors text-lg leading-none px-1"
                            aria-label="Dismiss"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
