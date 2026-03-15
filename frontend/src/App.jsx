import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Home } from '@/pages/Home';
import { AlbumDetail } from '@/pages/AlbumDetail';
import { ArtistDetail } from '@/pages/ArtistDetail';
import { PlaylistPage } from '@/pages/PlaylistPage';
import { StickyPlayer } from '@/components/player/StickyPlayer';
import { PlaylistModal } from '@/components/shared/PlaylistModal';
import { PlaylistProvider } from '@/context/PlaylistContext';
import { AuthProvider } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { BackendOfflinePage, BackendErrorBanner } from '@/components/shared/BackendError';
import { useBackendHealth } from '@/lib/useBackendHealth';
import { Navbar } from '@/components/shared/Navbar';

function AppContent() {
    const { isOnline, isChecking, retry } = useBackendHealth();
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const location = useLocation();
    const isHome = location.pathname === '/';

    // Reset banner if connection is lost again
    useEffect(() => {
        if (isOnline === false) setBannerDismissed(false);
    }, [isOnline]);

    // Full offline screen on first load when backend is unreachable
    if (isOnline === false) {
        return <BackendOfflinePage onRetry={retry} isRetrying={isChecking} />;
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Slim banner for transient/reconnection errors — dismissible */}
            {isOnline === null && !isChecking && !bannerDismissed && (
                <BackendErrorBanner
                    message="Connecting to the Volt Music backend…"
                    onRetry={retry}
                    isRetrying={isChecking}
                    onDismiss={() => setBannerDismissed(true)}
                />
            )}
            <Navbar />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/album/:albumId" element={<AlbumDetail />} />
                <Route path="/artist/:artistName" element={<ArtistDetail />} />
                <Route path="/playlist/:id" element={<PlaylistPage />} />
            </Routes>
            <StickyPlayer />
            <PlaylistModal />
        </div>
    );
}

function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <PlaylistProvider>
                    <Router>
                        <AppContent />
                    </Router>
                </PlaylistProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;
