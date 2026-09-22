import { useState, useEffect, useRef } from 'react';

/**
 * Returns [ref, inView].
 * Attach ref to the section's root element.
 * inView becomes true once the element is within rootMargin of the viewport,
 * then stays true permanently (sections don't un-load when scrolled away).
 */
export function useInView(rootMargin = '300px') {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (inView) return; // already triggered
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
            { rootMargin }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [inView, rootMargin]);

    return [ref, inView];
}
