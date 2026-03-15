import { useEffect, useRef } from 'react';

export function MusicBars({ isPlaying, analyser }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const animationRef = useRef(null);
    const prevBarsRef = useRef([]);
    const peaksRef = useRef([]);
    const peakDropRef = useRef([]);

    // Keep refs in sync with latest props so the rAF loop is never stale
    const isPlayingRef = useRef(isPlaying);
    const analyserRef = useRef(analyser);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { analyserRef.current = analyser; }, [analyser]);

    const getBarCount = () => {
        const w = window.innerWidth;
        if (w < 640) return 30; // Fewer bars on mobile to accommodate gaps
        if (w < 1024) return 50;
        return 75; // Substantially fewer bars than 120 so the gaps are clearly visible
    };
    const BAR_GAP = 6;

    // Start/stop the loop based on isPlaying
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Size canvas to physical pixels
        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            const { width, height } = container.getBoundingClientRect();
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        const render = () => {
            const playing = isPlayingRef.current;
            const asr = analyserRef.current;

            const BAR_COUNT = getBarCount();
            if (prevBarsRef.current.length !== BAR_COUNT) {
                prevBarsRef.current = new Array(BAR_COUNT).fill(0);
                peaksRef.current = new Array(BAR_COUNT).fill(0);
                peakDropRef.current = new Array(BAR_COUNT).fill(0);
            }

            const W = container.clientWidth;
            const H = container.clientHeight;
            ctx.clearRect(0, 0, W, H);

            // Define vertical gradient matching the reference image from bottom to top
            const gradient = ctx.createLinearGradient(0, H, 0, 0);
            gradient.addColorStop(0, '#560bad'); // Slightly brighter/lighter Navy Purple base
            gradient.addColorStop(0.2, '#4895ef'); // Brighter Neon Blue
            gradient.addColorStop(0.4, '#4cc9f0'); // Neon Cyan
            gradient.addColorStop(0.65, '#ffffff'); // Pure White (glowing mid-highs)
            gradient.addColorStop(0.85, '#f72585'); // Neon Pink / Magenta
            gradient.addColorStop(1, '#b5179e'); // Lighter Neon Violet at the very peaks

            let dataArray = null;
            if (asr) {
                // ── Auto-resume if context got suspended during navigation ──
                const actx = asr.context;
                if (actx.state === 'suspended') {
                    actx.resume().catch(() => {});
                    // Skip this frame — data will flow on next frame after resume
                } else {
                    dataArray = new Uint8Array(asr.frequencyBinCount);
                    asr.getByteFrequencyData(dataArray);
                    // If all zero (context not yet processing) → fall back to sim
                    if (!dataArray.some(v => v > 0)) dataArray = null;
                }
            }

            const totalBarW = (W - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;

            for (let i = 0; i < BAR_COUNT; i++) {
                let target = 3;

                if (dataArray) {
                    // Real analyser data — use logarithmic mapping for better sensitivity
                    const binCount = dataArray.length;
                    const minBin = 2; // Skip sub-bass noise floor
                    const maxBin = Math.floor(binCount * 0.5); // Focus on musical frequencies up to mid-highs
                    const t = i / BAR_COUNT;
                    const nextT = (i + 1) / BAR_COUNT;
                    // Logarithmic curve for frequencies mapping
                    const startBin = Math.floor(minBin + Math.pow(t, 2) * (maxBin - minBin));
                    const endBin = Math.max(startBin + 1, Math.floor(minBin + Math.pow(nextT, 2) * (maxBin - minBin)));

                    let sum = 0, cnt = 0;
                    for (let b = startBin; b < endBin && b < binCount; b++) {
                        sum += dataArray[b];
                        cnt++;
                    }
                    const avg = cnt > 0 ? sum / cnt : 0;

                    // EQ compensation: lower frequencies don't get much multiplier to prevent pegging
                    // Higher frequencies get a multiplier to stand out. And clear noise floor (-0.05).
                    const eqMult = 0.8 + (i / BAR_COUNT) * 1.5;
                    const norm = Math.max(0, Math.min(1, (avg / 255) * eqMult - 0.05));

                    // Decrease max height multiplier to prevent bars from reaching too high (Trap Nation style is lower on screen)
                    target = norm * H * 0.55;

                } else if (playing) {
                    // Animated simulation — time-based wave, looks musical
                    const t = Date.now() / 500;
                    const wave =
                        Math.sin(i * 0.13 + t) * 0.4 +
                        Math.sin(i * 0.07 - t * 1.3) * 0.3 +
                        Math.cos(i * 0.2 + t * 0.8) * 0.3;
                    const n = (wave + 1) / 2; // 0..1
                    target = Math.pow(n, 1.5) * H * 0.7;
                }

                // Smooth physics (Trap Nation style - instant hit, bouncy smooth decay)
                const prev = prevBarsRef.current[i] || 3;
                const current = target > prev
                    ? prev + (target - prev) * 0.65 // Faster attack (jumps up quicker to beat)
                    : prev * 0.90; // Slower, smoother decay (hangs in the air longer before falling)
                const clamped = Math.min(H, Math.max(3, current));
                prevBarsRef.current[i] = clamped;

                // Update peak cap physics
                const prevPeak = peaksRef.current[i] || clamped;
                if (clamped >= prevPeak) {
                    peaksRef.current[i] = clamped;
                    peakDropRef.current[i] = 0;
                } else {
                    peakDropRef.current[i] = (peakDropRef.current[i] || 0) + 0.15; // Gravity
                    peaksRef.current[i] = prevPeak - peakDropRef.current[i];
                    if (peaksRef.current[i] < clamped) peaksRef.current[i] = clamped;
                }
                const peakClamped = Math.max(0, peaksRef.current[i]);

                const x = i * (totalBarW + BAR_GAP);

                // Draw base segments
                const SEG_H = 3;
                const SEG_GAP = 1;
                const SEG_TOT = SEG_H + SEG_GAP;
                const segments = Math.floor(clamped / SEG_TOT);

                for (let s = 0; s < segments; s++) {
                    const segY = H - (s * SEG_TOT) - SEG_H;
                    ctx.fillStyle = gradient;
                    ctx.fillRect(x, segY, totalBarW, SEG_H);
                }

                // Draw Peak Cap (glowing)
                const peakY = H - peakClamped;
                ctx.fillStyle = '#ffffff'; // White/hot center
                ctx.shadowBlur = Math.min(10, clamped / 4); // Glow intensity scales with height
                ctx.shadowColor = '#00f3ff'; // Glow color
                ctx.fillRect(x, peakY - SEG_H, totalBarW, SEG_H);
                ctx.shadowBlur = 0; // Reset
            }

            // Keep looping as long as playing
            if (isPlayingRef.current) {
                animationRef.current = requestAnimationFrame(render);
            }
        };

        if (isPlaying) {
            // Cancel any existing loop before starting
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            render();
        } else {
            // Draw flat idle bars
            if (animationRef.current) cancelAnimationFrame(animationRef.current);

            const BAR_COUNT = getBarCount();
            const W = container.clientWidth;
            const H = container.clientHeight;
            ctx.clearRect(0, 0, W, H);
            const totalBarW = (W - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;
            for (let i = 0; i < BAR_COUNT; i++) {
                const x = i * (totalBarW + BAR_GAP);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(x, H - 3, totalBarW, 3);
            }
        }

        return () => {
            window.removeEventListener('resize', resize);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isPlaying]); // ← only re-run on isPlaying changes; analyser is read via ref live each frame

    return (
        <div ref={containerRef} className="w-full h-24 mb-0">
            <canvas
                ref={canvasRef}
                className="w-full h-full block"
                style={{ width: '100%', height: '100%' }}
            />
        </div>
    );
}
