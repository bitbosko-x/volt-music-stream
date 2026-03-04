import { useState, useRef } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SearchBar({ onSearch, query, setQuery, disabled }) {
    const wrapperRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim() && !disabled) {
            onSearch(query);
        }
    };

    return (
        <div ref={wrapperRef} className="relative flex flex-col sm:flex-row gap-3 w-full max-w-2xl mx-auto">
            <div className="relative flex-1 group">
                {/* Glow behind input on focus/hover */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00f3ff]/0 via-[#00f3ff]/10 to-[#00f3ff]/0 rounded-full blur opacity-0 group-hover:opacity-100 transition duration-500" />

                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400 z-10 transition-colors group-focus-within:text-[#00f3ff]" />

                <input
                    type="text"
                    disabled={disabled}
                    placeholder="Search for songs, albums, or artists..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                    className="relative w-full pl-12 pr-4 h-14 text-base bg-white/5 backdrop-blur-md rounded-full text-white placeholder:text-zinc-500 focus:outline-none focus:bg-white/10 transition-all shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                />
            </div>

            <Button
                onClick={(e) => handleSubmit(e)}
                disabled={!query.trim() || disabled}
                className="h-14 px-8 rounded-full bg-[#00f3ff] hover:bg-[#33f6ff] text-zinc-900 font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:shadow-[0_0_30px_rgba(0,243,255,0.5)] border-0"
            >
                Search
            </Button>
        </div>
    );
}
