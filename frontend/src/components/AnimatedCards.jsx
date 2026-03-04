import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListPlus, CheckCircle2 } from 'lucide-react';
import { usePlaylist } from '@/context/PlaylistContext';/* ─── HOOKS ─────────────────────────────────────────────── */
export function useInView(threshold = 0.15) {
    const ref = useRef();
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) setVisible(true); },
            { threshold }
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);
    return [ref, visible];
}

/* ─── ALBUM CARD ─────────────────────────────────────────── */
export function AnimatedAlbumCard({ item, delay = 0, onPlay, isPlaying, wrapperClass = "" }) {
    const [ref, visible] = useInView();
    const [hovered, setHovered] = useState(false);

    return (
        <div
            ref={ref}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => onPlay && onPlay(item)}
            className={wrapperClass}
            style={{
                width: 170, flexShrink: 0, cursor: "pointer",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0) scale(1)" : "translateY(28px) scale(0.94)",
                transition: `opacity .55s ease ${delay}ms, transform .55s cubic-bezier(.34,1.56,.64,1) ${delay}ms`,
            }}
        >
            <div style={{
                width: 170, height: 170, borderRadius: 12, overflow: "hidden", position: "relative",
                transform: hovered ? "scale(1.04) translateY(-3px)" : "scale(1)",
                transition: "transform .3s cubic-bezier(.34,1.56,.64,1)",
                boxShadow: hovered ? "0 18px 40px rgba(0,0,0,.55)" : "0 4px 16px rgba(0,0,0,.4)",
            }}>
                <img src={item.img || item.image || item.cover} alt={item.title || item.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.55))",
                    opacity: hovered ? 1 : 0, transition: "opacity .25s",
                }} />
                <div style={{
                    position: "absolute", bottom: 10, right: 10,
                    width: 38, height: 38, borderRadius: "50%",
                    background: "rgba(255,255,255,.95)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: hovered ? 1 : 0,
                    transform: hovered ? "scale(1)" : "scale(.5)",
                    transition: "all .25s cubic-bezier(.34,1.56,.64,1)",
                    boxShadow: "0 4px 12px rgba(0,0,0,.35)",
                }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#111"><polygon points="7,3 21,12 7,21" /></svg>
                </div>
            </div>
            <div style={{ padding: "10px 2px 0" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title || item.name}</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>{item.artist || item.subtitle}</div>
            </div>
        </div>
    );
}

/* ─── CITY CARD ──────────────────────────────────────────── */
export function AnimatedCityCard({ item, delay = 0, onClick }) {
    const [ref, visible] = useInView();
    const [hovered, setHovered] = useState(false);

    return (
        <div
            ref={ref}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => onClick && onClick(item)}
            style={{
                width: 320, height: 200, flexShrink: 0, borderRadius: 16,
                overflow: "hidden", position: "relative", cursor: "pointer",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0) scale(1)" : "translateY(24px) scale(.95)",
                transition: `opacity .5s ease ${delay}ms, transform .5s cubic-bezier(.34,1.56,.64,1) ${delay}ms`,
                boxShadow: hovered ? "0 20px 50px rgba(0,0,0,.6)" : "0 6px 20px rgba(0,0,0,.4)",
                background: `linear-gradient(135deg, ${item.color || '#333'} 0%, rgba(0,0,0,.8) 100%)`,
            }}
        >
            {(item.img || item.image) && (
                <img src={item.img || item.image} alt={item.city || item.title}
                    style={{
                        width: "100%", height: "100%", objectFit: "cover", display: "block",
                        transform: hovered ? "scale(1.07)" : "scale(1)",
                        transition: "transform .5s ease",
                    }} />
            )}
            <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,.75))",
            }} />
            <div style={{
                position: "absolute", bottom: 18, left: 18,
                fontSize: 20, fontWeight: 800, color: "#fff",
                fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.1,
                textShadow: "0 2px 10px rgba(0,0,0,.5)",
            }}>{item.city || item.title}</div>
        </div>
    );
}

/* ─── CATEGORY CARD ──────────────────────────────────────── */
export function AnimatedCategoryCard({ item, delay = 0, onClick, wrapperClass = "" }) {
    const [ref, visible] = useInView();
    const [hovered, setHovered] = useState(false);

    return (
        <div
            ref={ref}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => onClick && onClick(item)}
            className={wrapperClass}
            style={{
                width: 200, height: 110, flexShrink: 0, borderRadius: 12,
                overflow: "hidden", position: "relative", cursor: "pointer",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(20px)",
                transition: `opacity .5s ease ${delay}ms, transform .5s ease ${delay}ms`,
                boxShadow: hovered ? "0 14px 30px rgba(0,0,0,.6)" : "0 4px 12px rgba(0,0,0,.4)",
                backgroundColor: item.color || '#e84393',
            }}
        >
            {(item.img || item.image) && (
                <img src={item.img || item.image} alt={item.label || item.title}
                    style={{
                        width: "100%", height: "100%", objectFit: "cover", display: "block",
                        transform: hovered ? "scale(1.08)" : "scale(1)",
                        transition: "transform .4s ease",
                    }} />
            )}
            <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 70%)",
            }} />
            <div style={{
                position: "absolute", bottom: 12, left: 14,
                fontSize: 15, fontWeight: 800, color: "#fff",
                fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1,
            }}>{item.label || item.title}</div>
        </div>
    );
}

/* ─── TRENDING ROW (hero panel) ─────────────────────────── */
export function AnimatedTrendingRow({ song, delay = 0, active, onSelect }) {
    const [hovered, setHovered] = useState(false);
    const [ref, visible] = useInView(0.05);

    return (
        <div
            ref={ref}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onSelect}
            style={{
                display: "flex", alignItems: "center", gap: 12,
                background: active
                    ? "rgba(255,255,255,.07)"
                    : hovered ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.028)",
                border: active ? "1px solid rgba(181,240,0,.22)" : "1px solid rgba(255,255,255,.04)",
                borderRadius: 12, padding: "10px 12px", cursor: "pointer",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateX(0)" : "translateX(-16px)",
                transition: `opacity .45s ease ${delay}ms, transform .45s ease ${delay}ms, background .2s`,
            }}
        >
            <img src={song.img || song.image} alt={song.title}
                style={{ width: 42, height: 42, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: active ? "#00f3ff" : "#fff",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    transition: "color .2s",
                }}>{song.title}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{song.artist || song.subtitle}</div>
            </div>
            {active ? (
                <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 18, flexShrink: 0 }}>
                    {[0, 1, 2].map(i => (
                        <div key={i} style={{
                            width: 3, background: "#00f3ff", borderRadius: 2,
                            animation: `eq${i} ${.5 + i * .15}s ease-in-out infinite alternate`,
                            height: "100%", transformOrigin: "bottom",
                        }} />
                    ))}
                </div>
            ) : (
                <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: "rgba(255,255,255,.07)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: hovered ? 1 : 0,
                    transform: hovered ? "scale(1)" : "scale(.5)",
                    transition: "all .2s cubic-bezier(.34,1.56,.64,1)",
                    flexShrink: 0,
                }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="7,3 21,12 7,21" /></svg>
                </div>
            )}
        </div>
    );
}

/* ─── SONG LIST ROW (View All results) ───────────────────── */
export function SongListRow({ song, delay = 0, active, paused, onSelect, index }) {
    const [hovered, setHovered] = useState(false);
    const [ref, visible] = useInView(0.03);
    const isCurrentSong = active || paused;
    const navigate = useNavigate();
    const { openAddToPlaylist, isSongInAnyPlaylist } = usePlaylist();
    const inPlaylist = isSongInAnyPlaylist(song);

    const parseArtists = (artistString) => {
        if (!artistString) return [];
        return artistString.split(/,|&|feat\.|ft\.|featuring/i).map(a => a.trim()).filter(a => a.length > 0);
    };
    const artists = parseArtists(song.artist || song.subtitle);

    const handleArtistClick = (artistName, e) => {
        e.stopPropagation();
        navigate(`/artist/${encodeURIComponent(artistName)}`);
    };

    const handleAlbumClick = (e) => {
        e.stopPropagation();
        if (song.album_id) navigate(`/album/${song.album_id}`);
    };

    return (
        <div
            ref={ref}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => {
                if (active || paused) {
                    window.dispatchEvent(new CustomEvent('toggleGlobalPlay'));
                } else {
                    onSelect && onSelect();
                }
            }}
            style={{
                display: "flex", alignItems: "center", gap: 14,
                background: active
                    ? "rgba(181,240,0,.07)"
                    : paused ? "rgba(255,180,0,.04)"
                        : hovered ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.02)",
                border: active
                    ? "1px solid rgba(181,240,0,.25)"
                    : paused ? "1px solid rgba(255,180,0,.2)"
                        : "1px solid rgba(255,255,255,.05)",
                borderRadius: 14, padding: "10px 14px", cursor: "pointer",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateX(0)" : "translateX(-20px)",
                transition: `opacity .4s ease ${Math.min(delay, 400)}ms, transform .4s ease ${Math.min(delay, 400)}ms, background .2s, border-color .2s`,
            }}
        >
            {/* Left side: Play/Pause button and EQ */}
            <div style={{ width: 32, height: 32, flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {active ? (
                    // Playing - display EQ bars
                    <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 16 }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{
                                width: 3, background: "#00f3ff", borderRadius: 2,
                                animation: `eq${i} ${.5 + i * .15}s ease-in-out infinite alternate`,
                                height: "100%", transformOrigin: "bottom",
                            }} />
                        ))}
                    </div>
                ) : paused ? (
                    // Paused - display static bars with play icon on hover
                    hovered ? (
                        <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: "rgba(181,240,0,.15)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            animation: "scaleIn 0.2s ease"
                        }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="#00f3ff"><polygon points="7,3 21,12 7,21" /></svg>
                        </div>
                    ) : (
                        <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 16 }}>
                            {[10, 14, 8].map((h, i) => (
                                <div key={i} style={{
                                    width: 3, background: "rgba(255,180,0,.6)", borderRadius: 2,
                                    height: h, transformOrigin: "bottom",
                                }} />
                            ))}
                        </div>
                    )
                ) : (
                    // Default state - Number or Play icon on hover
                    hovered ? (
                        <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: "rgba(255,255,255,.07)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            animation: "scaleIn 0.2s ease"
                        }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><polygon points="7,3 21,12 7,21" /></svg>
                        </div>
                    ) : (
                        <span style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>{index + 1}</span>
                    )
                )}
            </div>

            {/* Album art with hover overlay */}
            <div style={{ position: "relative", flexShrink: 0 }}>
                <img
                    src={song.img || song.image}
                    alt={song.title}
                    style={{
                        width: 56, height: 56, borderRadius: 10, objectFit: "cover", display: "block",
                        filter: active ? "brightness(0.75)" : hovered ? "brightness(0.85)" : "brightness(1)",
                        transition: "filter .2s",
                    }}
                />
            </div>

            {/* Title + Artist + Album + Playing/Paused badge */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title row */}
                <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: active ? "#00f3ff" : paused ? "rgba(255,180,0,.9)" : "#fff",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    transition: "color .2s", marginBottom: 2,
                }}>{song.title}</div>

                {/* Playing / Paused badge — sits between title and artist */}
                {(active || paused) && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                        {active ? (
                            <div style={{
                                display: "flex", alignItems: "center", gap: 5,
                                background: "rgba(0,243,255,.15)", border: "1px solid rgba(0,243,255,.35)",
                                borderRadius: 20, padding: "2px 8px",
                            }}>
                                <div style={{
                                    width: 6, height: 6, borderRadius: "50%", background: "#00f3ff",
                                    animation: "pulseDot 1.2s ease-in-out infinite",
                                }} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#00f3ff", letterSpacing: 0.8, lineHeight: 1 }}>PLAYING</span>
                            </div>
                        ) : (
                            <div style={{
                                display: "flex", alignItems: "center", gap: 5,
                                background: "rgba(255,180,0,.1)", border: "1px solid rgba(255,180,0,.25)",
                                borderRadius: 20, padding: "2px 8px",
                            }}>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="rgba(255,180,0,.8)" style={{ flexShrink: 0 }}>
                                    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                                </svg>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,180,0,.8)", letterSpacing: 0.8, lineHeight: 1 }}>PAUSED</span>
                            </div>
                        )}
                    </div>
                )}
                {/* Artist · Album — clearly distinguished */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                    {/* Artist */}
                    <span style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: song.album ? "48%" : "100%", display: "flex", alignItems: "center", flexWrap: "nowrap" }}>
                        {artists.map((artist, i) => (
                            <span key={i} style={{ display: "inline-flex", whiteSpace: "nowrap" }}>
                                <span
                                    onClick={(e) => handleArtistClick(artist, e)}
                                    onMouseEnter={(e) => e.target.style.color = "#fff"}
                                    onMouseLeave={(e) => e.target.style.color = "#888"}
                                    style={{ cursor: "pointer", transition: "color 0.2s" }}
                                >
                                    {artist}
                                </span>
                                {i < artists.length - 1 && <span style={{ margin: "0 4px", color: "#555" }}>•</span>}
                            </span>
                        ))}
                    </span>
                    {/* Album — only if different from artist */}
                    {song.album && (
                        <>
                            <span style={{ color: "#333", fontSize: 11, flexShrink: 0 }}>·</span>
                            <span
                                onClick={handleAlbumClick}
                                onMouseEnter={(e) => e.target.style.color = "#fff"}
                                onMouseLeave={(e) => e.target.style.color = "#444"}
                                style={{
                                    fontSize: 11, color: "#444", cursor: "pointer", transition: "color 0.2s",
                                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                    display: "flex", alignItems: "center", gap: 3,
                                }}>
                                {/* Mini disc icon */}
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                                </svg>
                                {song.album}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Right actions: Add to Playlist ONLY */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                {/* Add to playlist button (Always visible for touch screens) */}
                <button
                    onClick={(e) => { e.stopPropagation(); openAddToPlaylist(song); }}
                    style={{
                        padding: 6,
                        borderRadius: "50%",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: inPlaylist ? "#22c55e" : (hovered ? "#fff" : "#999"),
                        opacity: 1,
                        transition: "all 0.2s ease"
                    }}
                    title={inPlaylist ? 'In a playlist' : 'Add to playlist'}
                >
                    {inPlaylist
                        ? <CheckCircle2 size={18} />
                        : <ListPlus size={18} />
                    }
                </button>
            </div>
        </div>
    );
}

/* ─── ALBUM LIST ROW (View All albums) ───────────────────── */
export function AlbumListRow({ album, delay = 0, onClick, index }) {
    const [hovered, setHovered] = useState(false);
    const [ref, visible] = useInView(0.03);

    return (
        <div
            ref={ref}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => onClick && onClick(album)}
            style={{
                display: "flex", alignItems: "center", gap: 14,
                background: hovered ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.02)",
                border: "1px solid rgba(255,255,255,.05)",
                borderRadius: 14, padding: "10px 14px", cursor: "pointer",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateX(0)" : "translateX(-20px)",
                transition: `opacity .4s ease ${Math.min(delay, 400)}ms, transform .4s ease ${Math.min(delay, 400)}ms, background .2s`,
            }}
        >
            <span style={{ width: 20, fontSize: 12, color: "#444", fontWeight: 500, textAlign: "center", flexShrink: 0 }}>{index + 1}</span>
            <img
                src={album.img || album.image}
                alt={album.title}
                style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 14, fontWeight: 600, color: "#fff",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2,
                }}>{album.title || album.name}</div>
                <div style={{ fontSize: 12, color: "#777" }}>
                    {album.artist}
                    {album.track_count ? <span style={{ color: "#444" }}> · {album.track_count} tracks</span> : null}
                </div>
            </div>
            <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(255,255,255,.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: hovered ? 1 : 0,
                transform: hovered ? "scale(1)" : "scale(.6)",
                transition: "all .2s cubic-bezier(.34,1.56,.64,1)",
                flexShrink: 0,
            }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><polygon points="7,3 21,12 7,21" /></svg>
            </div>
        </div>
    );
}



/* ─── SECTION HEADER ─────────────────────────────────────── */
export function AnimatedSectionHeader({ title, sub }) {
    const [ref, visible] = useInView();
    return (
        <div ref={ref} style={{
            marginBottom: 20,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(14px)",
            transition: "opacity .5s ease, transform .5s ease",
        }}>
            <h2 style={{
                fontSize: 26, fontWeight: 800, color: "#fff",
                fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1,
            }}>{title}</h2>
            {sub && <p style={{ fontSize: 12, color: "#555", marginTop: 3 }}>{sub}</p>}
        </div>
    );
}
