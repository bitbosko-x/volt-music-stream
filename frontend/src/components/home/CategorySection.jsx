export function CategorySection({ title, icon, count, children }) {
    return (
        <div className="mb-8">
            <div className="flex items-center gap-3 mb-4 pb-2 border-b border-border">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span>{icon}</span>
                    {title}
                </h2>
                <span className="text-sm text-muted-foreground">({count})</span>
            </div>
            <div className="space-y-2">
                {children}
            </div>
        </div>
    );
}
