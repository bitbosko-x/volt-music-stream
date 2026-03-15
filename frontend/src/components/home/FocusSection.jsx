import { AnimatedSectionHeader, AnimatedCategoryCard } from '@/components/cards/AnimatedCards';
import { Brain } from 'lucide-react';

export function FocusSection({ onCategoryClick }) {

    const focusPlaylists = [
        {
            title: "Lofi Beats",
            subtitle: "Chill & Relax",
            color: "#f97316",
            image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&q=80",
            query: "lofi hip hop chill beats"
        },
        {
            title: "Deep Focus",
            subtitle: "Instrumental Study",
            color: "#3b82f6",
            image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&q=80",
            query: "instrumental deep focus study music"
        },
        {
            title: "Ambient Calm",
            subtitle: "Stress Relief",
            color: "#10b981",
            image: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=400&q=80",
            query: "ambient calm meditation music"
        }
    ];

    return (
        <section style={{ padding: "0 0 36px" }}>
            <AnimatedSectionHeader title="Focus & Study" sub="Get into the zone" />
            <div className="hscroll">
                {focusPlaylists.map((playlist, idx) => (
                    <AnimatedCategoryCard
                        key={idx}
                        item={{ ...playlist, label: playlist.title }}
                        delay={idx * 60}
                        onClick={() => onCategoryClick({
                            id: `focus_${idx}`,
                            title: playlist.title,
                            description: playlist.subtitle,
                            query: playlist.query
                        })}
                    />
                ))}
            </div>
        </section>
    );
}
