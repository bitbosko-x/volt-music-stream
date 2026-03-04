import { useState, useEffect, useCallback } from 'react';

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const TIMEOUT_MS = 5000;
const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Custom hook that continuously monitors backend connectivity.
 * Returns { isOnline, isChecking, lastChecked, retry }
 */
export function useBackendHealth() {
    const [isOnline, setIsOnline] = useState(null); // null = unknown (first check pending)
    const [isChecking, setIsChecking] = useState(true);
    const [lastChecked, setLastChecked] = useState(null);

    const check = useCallback(async () => {
        setIsChecking(true);
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

            // Lightweight probe — ping endpoint
            const res = await fetch(`${API_BASE}/ping`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timer);

            // 429 = rate-limited but backend IS alive
            setIsOnline(res.ok || res.status === 429 || res.status === 404);
        } catch {
            setIsOnline(false);
        } finally {
            setIsChecking(false);
            setLastChecked(new Date());
        }
    }, []);

    // Initial check + periodic polling
    useEffect(() => {
        check();
        const interval = setInterval(check, HEALTH_CHECK_INTERVAL);
        return () => clearInterval(interval);
    }, [check]);

    return { isOnline, isChecking, lastChecked, retry: check };
}