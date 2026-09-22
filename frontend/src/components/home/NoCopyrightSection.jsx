import { useState, useEffect } from 'react';
import { searchMusic } from '@/lib/api';
import { useInView } from '@/lib/useInView';
import { AnimatedSectionHeader, AnimatedCategoryCard } from '@/components/cards/AnimatedCards';

const CACHE_KEY = 'volt_nocopyright_images';
const CACHE_TTL = 7 * 24 * 3600 * 1000; // 7 days

const creators = [
    { name: "NCS",         subtitle: "NoCopyrightSounds", itunesQuery: "Cartoon On On feat Daniel Levi", query: "NoCopyrightSounds", fallbackColor: "06B6D4" },
    { name: "Alan Walker", subtitle: "Electronic / EDM",  itunesQuery: "Alan Walker Faded",              query: "Alan Walker",       fallbackColor: "1E3A5F" },
    { name: "Elektronomia",subtitle: "NCS Release",        itunesQuery: "Elektronomia Sky High",          query: "Elektronomia",      fallbackColor: "7C3AED" },
    { name: "TheFatRat",   subtitle: "Free music",         itunesQuery: "TheFatRat Unity",               query: "TheFatRat",         fallbackColor: "F97316" },
    { name: "Tobu",        subtitle: "Free to use",        itunesQuery: "Tobu Hope",                     query: "Tobu",              fallbackColor: "10B981" },
    { name: "Disfigure",   subtitle: "NCS Release",        itunesQuery: "Disfigure Blank",               query: "Disfigure",         fallbackColor: "EC4899" },
];

function fallbackAvatar(name, color) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=${color}&color=fff&bold=true&font-size=0.35`;
}

function loadCachedImages() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { ts, images } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) return images;
    } catch (_) {}
    return null;
}

function saveCachedImages(images) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), images })); } catch (_) {}
}

export function NoCopyrightSection({ onCategoryClick }) {
    const cached = loadCachedImages();
    const [images, setImages] = useState(cached || creators.map((c) => fallbackAvatar(c.name, c.fallbackColor)));
    const [ref, inView] = useInView('400px');

    useEffect(() => {
        if (!inView || cached) return; // skip fetch if already cached
        let cancelled = false;
        (async () => {
            const results = await Promise.all(
                creators.map(async (c) => {
                    try {
                        const data = await searchMusic(c.itunesQuery);
                        if (data?.songs?.[0]?.image) return data.songs[0].image;
                    } catch (_) {}
                    return fallbackAvatar(c.name, c.fallbackColor);
                })
            );
            if (!cancelled) { setImages(results); saveCachedImages(results); }
        })();
        return () => { cancelled = true; };
    }, [inView]);

    return (
        <section ref={ref} style={{ padding: "0 0 36px" }}>
            <AnimatedSectionHeader title="No Copyright Music" sub="Free-to-use tracks for creators" />
            <div className="hscroll">
                {creators.map((creator, idx) => (
                    <AnimatedCategoryCard
                        key={idx}
                        item={{ label: creator.name, image: images[idx], color: `#${creator.fallbackColor}` }}
                        delay={idx * 60}
                        onClick={() => onCategoryClick({ id: `nocopyright_${idx}`, title: creator.name, description: creator.subtitle, query: creator.query })}
                    />
                ))}
            </div>
        </section>
    );
}
