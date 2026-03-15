import { useState, useEffect } from 'react';
import { searchMusic } from '@/lib/api';
import { AnimatedSectionHeader, AnimatedCategoryCard } from '@/components/cards/AnimatedCards';

const creators = [
    {
        name: "NCS",
        subtitle: "NoCopyrightSounds",
        itunesQuery: "Cartoon On On feat Daniel Levi",
        query: "NoCopyrightSounds",
        fallbackColor: "06B6D4",
    },
    {
        name: "Alan Walker",
        subtitle: "Electronic / EDM",
        itunesQuery: "Alan Walker Faded",
        query: "Alan Walker",
        fallbackColor: "1E3A5F",
    },
    {
        name: "Elektronomia",
        subtitle: "NCS Release",
        itunesQuery: "Elektronomia Sky High",
        query: "Elektronomia",
        fallbackColor: "7C3AED",
    },
    {
        name: "TheFatRat",
        subtitle: "Free music",
        itunesQuery: "TheFatRat Unity",
        query: "TheFatRat",
        fallbackColor: "F97316",
    },
    {
        name: "Tobu",
        subtitle: "Free to use",
        itunesQuery: "Tobu Hope",
        query: "Tobu",
        fallbackColor: "10B981",
    },
    {
        name: "Disfigure",
        subtitle: "NCS Release",
        itunesQuery: "Disfigure Blank",
        query: "Disfigure",
        fallbackColor: "EC4899",
    },
];

async function fetchSongArt(itunesQuery, fallbackColor, name) {
    try {
        const data = await searchMusic(itunesQuery);
        if (data && data.songs && data.songs.length > 0) {
            return data.songs[0].image;
        }
    } catch (_) { }
    // Fallback UI Avatar
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=${fallbackColor}&color=fff&bold=true&font-size=0.35`;
}

export function NoCopyrightSection({ onCategoryClick }) {
    const [images, setImages] = useState([]);

    useEffect(() => {
        let cancelled = false;

        const loadImages = async () => {
            const promises = creators.map(c => fetchSongArt(c.itunesQuery, c.fallbackColor, c.name));
            const results = await Promise.all(promises);
            if (!cancelled) {
                setImages(results);
            }
        };

        loadImages();
        return () => { cancelled = true; };
    }, []);

    return (
        <section style={{ padding: "0 0 36px" }}>
            <AnimatedSectionHeader title="No Copyright Music" sub="Free-to-use tracks for creators" />
            <div className="hscroll">
                {creators.map((creator, idx) => (
                    <AnimatedCategoryCard
                        key={idx}
                        item={{
                            label: creator.name,
                            image: images[idx],
                            color: `#${creator.fallbackColor}`
                        }}
                        delay={idx * 60}
                        onClick={() => onCategoryClick({
                            id: `nocopyright_${idx}`,
                            title: creator.name,
                            description: creator.subtitle,
                            query: creator.query,
                        })}
                    />
                ))}
            </div>
        </section>
    );
}
