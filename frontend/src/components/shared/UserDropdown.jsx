import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, User } from 'lucide-react';

export function UserDropdown({ className = '' }) {
    const { currentUser, loginWithGoogle, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /* ── Guest / logged-out state — mock avatar ── */
    if (!currentUser) {
        return (
            <button
                onClick={loginWithGoogle}
                title="Sign in"
                className={`group rounded-full overflow-hidden border-2 border-white/20
                    hover:border-[#00f3ff]/60 hover:shadow-[0_0_10px_rgba(0,243,255,0.25)]
                    transition-all duration-200 focus:outline-none active:scale-95
                    shrink-0 bg-zinc-800 ${className}`}
            >
                {/* Generic user silhouette */}
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <rect width="40" height="40" fill="#27272a"/>
                    {/* Head */}
                    <circle cx="20" cy="15" r="7" fill="#52525b"/>
                    {/* Body */}
                    <ellipse cx="20" cy="34" rx="12" ry="9" fill="#52525b"/>
                </svg>
            </button>
        );
    }

    /* ── Logged-in state ── */
    const initials = (currentUser.displayName || 'U')
        .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(v => !v)}
                title={currentUser.displayName}
                className={`rounded-full overflow-hidden border-2 transition-all duration-200
                    ${isOpen
                        ? 'border-[#00f3ff] shadow-[0_0_12px_rgba(0,243,255,0.5)]'
                        : 'border-white/20 hover:border-white/50 hover:shadow-[0_0_10px_rgba(255,255,255,0.15)]'}
                    focus:outline-none active:scale-95 shrink-0 ${className}`}
            >
                {currentUser.photoURL ? (
                    <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName || 'Profile'}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="h-full w-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white font-bold text-xs">
                        {initials}
                    </div>
                )}
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2.5 w-56 z-[200]
                    bg-zinc-900/95 backdrop-blur-xl
                    border border-white/10 rounded-2xl shadow-2xl
                    overflow-hidden
                    origin-top-right animate-in fade-in slide-in-from-top-2 duration-150">

                    {/* User info */}
                    <div className="px-4 py-3.5 flex items-center gap-3 border-b border-white/10">
                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/10">
                            {currentUser.photoURL ? (
                                <img
                                    src={currentUser.photoURL}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white font-bold text-xs">
                                    {initials}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate leading-tight">
                                {currentUser.displayName}
                            </p>
                            <p className="text-xs text-zinc-400 truncate mt-0.5">
                                {currentUser.email}
                            </p>
                        </div>
                    </div>

                    {/* Logout */}
                    <button
                        onClick={() => { setIsOpen(false); logout(); }}
                        className="w-full text-left px-4 py-3 text-sm text-red-400
                            hover:bg-red-500/10 hover:text-red-300
                            flex items-center gap-2.5 transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
