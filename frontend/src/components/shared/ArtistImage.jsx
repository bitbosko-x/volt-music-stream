import { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// SVG placeholder — a clean profile silhouette matching the Volt dark theme
const PLACEHOLDER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23111827'/%3E%3Ccircle cx='100' cy='82' r='38' fill='%23374151'/%3E%3Cellipse cx='100' cy='175' rx='62' ry='42' fill='%23374151'/%3E%3C/svg%3E`;

// Simple in-memory cache so repeated renders don't re-fetch
const _cache = {};

/**
 * ArtistImage — lazy-loads artist photo from Last.fm / Deezer via /api/artist-image.
 *
 * Props:
 *   name        {string}  Artist name — used for the API lookup key
 *   src         {string}  Optional pre-fetched URL (skips API call if truthy)
 *   alt         {string}  img alt text
 *   className   {string}  Class passed to the <img> element
 *   style       {object}  Style passed to the <img> element
 */
export function ArtistImage({ name, src, alt, className = '', style = {} }) {
    const [imgSrc, setImgSrc] = useState(src || (_cache[name] ?? null));
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        // If we already have a URL (from prop or cache), use it directly
        if (src) {
            setImgSrc(src);
            return;
        }
        if (_cache[name] !== undefined) {
            setImgSrc(_cache[name] || PLACEHOLDER_SVG);
            return;
        }
        if (!name) {
            setImgSrc(PLACEHOLDER_SVG);
            return;
        }

        // Mark as fetching so concurrent renders don't duplicate the call
        _cache[name] = null; // sentinel

        fetch(`${API_BASE}/artist-image?name=${encodeURIComponent(name)}`)
            .then(r => r.json())
            .then(({ image }) => {
                const resolved = image || PLACEHOLDER_SVG;
                _cache[name] = resolved;
                if (mounted.current) setImgSrc(resolved);
            })
            .catch(() => {
                _cache[name] = PLACEHOLDER_SVG;
                if (mounted.current) setImgSrc(PLACEHOLDER_SVG);
            });
    }, [name, src]);

    return (
        <img
            src={imgSrc || PLACEHOLDER_SVG}
            alt={alt || name}
            className={className}
            style={style}
            onError={(e) => { e.currentTarget.src = PLACEHOLDER_SVG; }}
        />
    );
}
