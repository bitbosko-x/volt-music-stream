import { useState, useEffect, useCallback, useRef } from 'react';

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const TIMEOUT_MS = 8000;             // Generous timeout for slow cold starts
const INITIAL_DELAY_MS = 300;        // Small delay before first ping to let backend warm up
const MAX_CONSECUTIVE_FAILURES = 2;  // Only go offline after 2 failed checks in a row
const QUICK_RETRY_MS = 3000;         // Retry delay after first failure (backend may be restarting)
const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Custom hook that continuously monitors backend connectivity.
 * Returns { isOnline, isChecking, lastChecked, retry }
 *
 * Key behaviours:
 *  - Waits INITIAL_DELAY_MS before the very first check to avoid
 *    false-offline flashes when the backend is still booting.
 *  - Only sets isOnline=false after MAX_CONSECUTIVE_FAILURES consecutive
 *    failed pings, so a single network hiccup never triggers the offline page.
 *  - On the first failure, keeps isChecking=true and schedules a quick
 *    retry (3 s) so the "Connecting…" banner never flashes during a brief
 *    backend restart.
 *  - Manual retry() resets the failure counter immediately.
 */
export function useBackendHealth() {
    const [isOnline, setIsOnline] = useState(null); // null = unknown (first check pending)
    const [isChecking, setIsChecking] = useState(true);
    const [lastChecked, setLastChecked] = useState(null);
    const failureCount = useRef(0);
    const quickRetryRef = useRef(null);

    const check = useCallback(async (resetFailures = false) => {
        if (resetFailures) failureCount.current = 0;
        // Cancel any pending quick-retry so we don't double-fire
        if (quickRetryRef.current) {
            clearTimeout(quickRetryRef.current);
            quickRetryRef.current = null;
        }
        setIsChecking(true);
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

            const res = await fetch(`${API_BASE}/ping`, {
                method: 'GET',
                signal: controller.signal,
                // Bypass browser cache so we always get a real response
                cache: 'no-store',
            });
            clearTimeout(timer);

            // 429 = rate-limited but backend IS alive
            const alive = res.ok || res.status === 429 || res.status === 404;
            if (alive) {
                failureCount.current = 0;
                setIsOnline(true);
            } else {
                failureCount.current += 1;
                if (failureCount.current >= MAX_CONSECUTIVE_FAILURES) {
                    setIsOnline(false);
                }
            }
        } catch {
            failureCount.current += 1;
            if (failureCount.current >= MAX_CONSECUTIVE_FAILURES) {
                setIsOnline(false);
            }
        } finally {
            setLastChecked(new Date());
            if (failureCount.current === 0 || failureCount.current >= MAX_CONSECUTIVE_FAILURES) {
                // Definitive answer — either confirmed online or confirmed offline
                setIsChecking(false);
            } else {
                // First failure: keep isChecking=true so the banner never flashes,
                // and schedule a quick retry instead of waiting the full 30 s interval.
                quickRetryRef.current = setTimeout(() => check(), QUICK_RETRY_MS);
            }
        }
    }, []);

    // Initial check (with a tiny delay) + periodic polling
    useEffect(() => {
        const initial = setTimeout(() => check(), INITIAL_DELAY_MS);
        const interval = setInterval(() => check(), HEALTH_CHECK_INTERVAL);
        return () => {
            clearTimeout(initial);
            clearInterval(interval);
            if (quickRetryRef.current) clearTimeout(quickRetryRef.current);
        };
    }, [check]);

    // retry() resets the failure counter so one manual retry is enough
    const retry = useCallback(() => check(true), [check]);

    return { isOnline, isChecking, lastChecked, retry };
}
