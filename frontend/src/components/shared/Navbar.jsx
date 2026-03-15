import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '@/components/shared/SearchBar';
import { User, Search, X } from 'lucide-react';
import { AnimatedLogo } from '@/components/shared/AnimatedLogo';
import { UserDropdown } from '@/components/shared/UserDropdown';
import { useAuth } from '@/context/AuthContext';

export function Navbar() {
    const { currentUser, loginWithGoogle, logout } = useAuth();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    const handleSearch = (searchQuery) => {
        if (!searchQuery.trim()) return;
        setIsMobileSearchOpen(false);
        navigate(`/?q=${encodeURIComponent(searchQuery)}`);
    };

    return (
        <div className="w-full px-4 sm:px-6 md:px-8 xl:px-12 py-3 sm:py-4 flex flex-col z-50 relative bg-zinc-950/80 backdrop-blur-lg border-b border-white/5 sticky top-0">
            {/* Desktop Navbar */}
            <div className="hidden lg:flex items-center justify-between w-full gap-8 max-w-[1920px] mx-auto">
                <button
                    className="flex items-center gap-4 hover:scale-105 transition-transform"
                    onClick={() => { setQuery(''); navigate('/'); }}
                >
                    <AnimatedLogo className="h-10 w-10" isPlaying={true} />
                    <h1 className="text-2xl tracking-widest text-[#f5f5f5] pt-1" style={{ fontFamily: '"Monoton", sans-serif', textShadow: '0 2px 10px rgba(0,0,0,0.5)', lineHeight: 1 }}>
                        Volt Music
                    </h1>
                </button>
                <div className="flex-1 max-w-2xl px-4">
                    <SearchBar onSearch={handleSearch} query={query} setQuery={setQuery} />
                </div>
                <UserDropdown className="h-11 w-11" />
            </div>

            {/* Mobile Navbar */}
            <div className="flex lg:hidden flex-col w-full">
                <div className="flex items-center justify-between w-full">
                    <button
                        className="flex items-center gap-2 relative z-20"
                        onClick={() => { setQuery(''); navigate('/'); }}
                    >
                        <AnimatedLogo className="h-8 w-8 sm:h-10 sm:w-10" isPlaying={true} />
                        <h1 className="text-xl sm:text-2xl tracking-widest text-[#f5f5f5] whitespace-nowrap pt-1" style={{ fontFamily: '"Monoton", sans-serif', textShadow: '0 2px 10px rgba(0,0,0,0.5)', lineHeight: 1 }}>
                            Volt Music
                        </h1>
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                            className={`p-1 transition-colors relative z-20 ${isMobileSearchOpen ? 'text-[#00f3ff]' : 'text-white hover:text-[#00f3ff]'}`}
                        >
                            {isMobileSearchOpen ? <X className="h-6 w-6 sm:h-7 sm:w-7" /> : <Search className="h-6 w-6 sm:h-7 sm:w-7" />}
                        </button>
                        <UserDropdown className="h-8 w-8 sm:h-9 sm:w-9 relative z-20" />
                    </div>
                </div>
                <div className={`transition-all duration-300 ease-in-out overflow-hidden w-full relative z-10 ${isMobileSearchOpen ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0 pointer-events-none'}`}>
                    <SearchBar onSearch={(q) => { handleSearch(q); setIsMobileSearchOpen(false); }} query={query} setQuery={setQuery} />
                </div>
            </div>
        </div>
    );
}
