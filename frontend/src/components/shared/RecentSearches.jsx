import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, X, Music, Disc, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const RECENT_KEY = 'recentActivity';
const MAX_ITEMS = 12;

/** Utility: add an item to the recent activity list */
export async function addRecentItem(item) {
    try {
        const existing = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        // Remove duplicates by id/name
        const deduped = existing.filter(i => {
            if (item.type === 'song') return i.id !== item.id || i.type !== item.type;
            if (item.type === 'album') return i.id !== item.id || i.type !== item.type;
            if (item.type === 'artist') return i.name !== item.name || i.type !== item.type;
            return true;
        });
        const updated = [item, ...deduped].slice(0, MAX_ITEMS);
        
        // 1. Always save locally for instant feedback
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
        
        // 2. Sync to Firestore if logged in
        if (auth?.currentUser) {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            await setDoc(userRef, { recentSearches: updated }, { merge: true });
        }
    } catch (e) {
        console.error('RecentSearches: Failed to save item', e);
    }
}

const TYPE_META = {
    song: { icon: Music, label: 'Song', color: '#00f3ff' },
    album: { icon: Disc, label: 'Album', color: '#b5f000' },
    artist: { icon: User, label: 'Artist', color: '#d060e8' },
};

export function RecentSearches({ onSearchClick }) {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const { currentUser, isGuest } = useAuth();

    const loadLocal = () => {
        const data = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        setItems(data);
    };

    useEffect(() => {
        if (isGuest) {
            loadLocal();
        } else if (currentUser) {
            const userRef = doc(db, 'users', currentUser.uid);
            const unsub = onSnapshot(userRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    if (data.recentSearches) {
                        setItems(data.recentSearches);
                    } else {
                        setItems([]);
                    }
                } else {
                    // Try to merge local data on first login
                    const localData = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
                    if (localData.length > 0) {
                        setDoc(userRef, { recentSearches: localData }, { merge: true });
                    }
                    setItems([]);
                }
            });
            return () => unsub();
        }
    }, [currentUser, isGuest]);

    const remove = async (idx, e) => {
        e.stopPropagation();
        const data = [...items];
        data.splice(idx, 1);
        setItems(data); // Optimistic UI
        
        localStorage.setItem(RECENT_KEY, JSON.stringify(data));
        
        if (currentUser) {
            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, { recentSearches: data }, { merge: true });
        }
    };

    const clearAll = async () => {
        setItems([]);
        localStorage.removeItem(RECENT_KEY);
        localStorage.removeItem('searchHistory'); // backwards compat
        
        if (currentUser) {
            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, { recentSearches: [] }, { merge: true });
        }
    };

    const handleClick = (item) => {
        if (item.type === 'song') {
            window.dispatchEvent(new CustomEvent('playTrack', {
                detail: {
                    title: item.title,
                    artist: item.artist,
                    img: item.image,
                    album: item.album || null,
                    album_id: item.album_id || null,
                    search_term: item.search_term || item.id,
                }
            }));
        } else if (item.type === 'album') {
            navigate(`/album/${item.id}`);
        } else if (item.type === 'artist') {
            navigate(`/artist/${encodeURIComponent(item.name)}`);
        }
    };

    if (items.length === 0) return null;

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Recent
                </h2>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    className="text-muted-foreground hover:text-foreground text-xs"
                >
                    Clear All
                </Button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {items.map((item, idx) => {
                    const meta = TYPE_META[item.type] || TYPE_META.song;
                    const Icon = meta.icon;
                    const isArtist = item.type === 'artist';

                    return (
                        <div
                            key={idx}
                            onClick={() => handleClick(item)}
                            className="relative flex-shrink-0 group cursor-pointer"
                            style={{ width: 120 }}
                        >
                            {/* Thumbnail */}
                            <div style={{
                                width: 120, height: 120,
                                borderRadius: isArtist ? '50%' : 12,
                                overflow: 'hidden',
                                background: '#1a1a2e',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                position: 'relative',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
                                    e.currentTarget.style.boxShadow = `0 12px 30px rgba(0,0,0,0.6), 0 0 0 2px ${meta.color}44`;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = '';
                                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
                                }}
                            >
                                {item.image ? (
                                    <img
                                        src={item.image}
                                        alt={item.title || item.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, opacity: 0.5 }}>
                                        <Icon size={40} />
                                    </div>
                                )}

                                {/* Type badge overlay */}
                                <div style={{
                                    position: 'absolute', bottom: 6, left: 6,
                                    display: 'flex', alignItems: 'center', gap: 3,
                                    background: 'rgba(0,0,0,0.75)',
                                    borderRadius: 20, padding: '2px 7px',
                                    backdropFilter: 'blur(4px)',
                                }}>
                                    <Icon size={9} color={meta.color} />
                                    <span style={{ fontSize: 9, color: meta.color, fontWeight: 700, letterSpacing: 0.5 }}>{meta.label.toUpperCase()}</span>
                                </div>

                                {/* Remove button */}
                                <button
                                    onClick={(e) => remove(idx, e)}
                                    style={{
                                        position: 'absolute', top: 5, right: 5,
                                        background: 'rgba(0,0,0,0.7)',
                                        border: 'none', borderRadius: '50%',
                                        width: 22, height: 22,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'opacity 0.2s',
                                        color: '#fff',
                                    }}
                                    className="opacity-100 md:opacity-0 group-hover:!opacity-100"
                                >
                                    <X size={12} />
                                </button>
                            </div>

                            {/* Label */}
                            <p style={{
                                marginTop: 8, fontSize: 12, fontWeight: 600, color: '#ddd',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                width: '100%', textAlign: isArtist ? 'center' : 'left',
                                transition: 'color 0.2s',
                            }}
                                className="group-hover:text-white"
                            >
                                {item.title || item.name}
                            </p>
                            {(item.artist || item.subtitle) && (
                                <p style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: isArtist ? 'center' : 'left' }}>
                                    {item.artist || item.subtitle}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
