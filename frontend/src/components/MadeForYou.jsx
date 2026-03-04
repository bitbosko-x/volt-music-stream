import { AnimatedSectionHeader, AnimatedCategoryCard } from '@/components/AnimatedCards';

export function MadeForYou({ onCategoryClick }) {

    const mixes = [
        {
            title: "My Super Mix",
            subtitle: "Your favorite styles",
            color: "#ec4899", // Pink
            query: "best songs mix"
        },
        {
            title: "Discover Mix",
            subtitle: "New gems for you",
            color: "#6366f1", // Indigo
            query: "new music mix"
        },
        {
            title: "Chill Mix",
            subtitle: "Relax & Unwind",
            color: "#06b6d4", // Cyan
            query: "chill mix"
        },
        {
            title: "Party Mix",
            subtitle: "Get the energy up",
            color: "#eab308", // Yellow
            query: "party mix"
        }
    ];

    return (
        <section style={{ padding: "0 0 36px" }}>
            <AnimatedSectionHeader title="Made For You" sub="Curated just for your vibe" />
            <div className="hscroll">
                {mixes.map((mix, idx) => (
                    <AnimatedCategoryCard
                        key={idx}
                        item={{ ...mix, label: mix.title }}
                        delay={idx * 65}
                        onClick={() => onCategoryClick({
                            id: `mix_${idx}`,
                            title: mix.title,
                            description: mix.subtitle,
                            query: mix.query
                        })}
                    />
                ))}
            </div>
        </section>
    );
}
