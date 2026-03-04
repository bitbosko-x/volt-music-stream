import { AnimatedSectionHeader, AnimatedCategoryCard } from '@/components/AnimatedCards';

export function FeaturedCategories({ onCategoryClick }) {
    const categories = [
        { id: 'latest', title: 'Latest Releases', query: 'Taylor Swift Post Malone new songs', image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80", color: "#e84393" },
        // top100 has curated backend endpoint — no query, uses getCategorySongs(id)
        { id: 'top100', title: 'Top 100', image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80", color: "#f5a623" },
        { id: 'trending', title: 'Trending Now', query: 'Kendrick Lamar Doja Cat Ariana Grande songs', image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80", color: "#7b2fff" },
        { id: 'hits', title: 'Greatest Hits', query: 'Michael Jackson Beatles Queen Eagles songs', image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80", color: "#00d2ff" }
    ];

    return (
        <section style={{ padding: "0 0 36px" }}>
            <AnimatedSectionHeader title="Explore Music" sub="Find your rhythm" />
            <div className="hscroll">
                {categories.map((category, idx) => (
                    <AnimatedCategoryCard
                        key={category.id}
                        wrapperClass={idx >= 3 ? 'hidden sm:block' : ''}
                        item={{ ...category, label: category.title }}
                        delay={idx * 60}
                        onClick={() => onCategoryClick(category)}
                    />
                ))}
            </div>
        </section>
    );
}
