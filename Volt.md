# Volt - Music Streaming Application Summary

**Volt** is a full-stack music streaming web application that provides free streaming by combining multiple music sources (JioSaavn, YouTube) with metadata from Apple Music/iTunes.

### Architecture
- **Frontend**: React 18 + Vite + TailwindCSS + shadcn/ui components
- **Backend**: Flask API with Python engines
- **Deployment**: Supports both development and production (Gunicorn)

---

### Backend Features (Python)

| Engine | Features |
|--------|----------|
| **hub.py** | Hybrid search orchestration, fuzzy matching, smart artist matching, version preference (penalizes remixes when not requested) |
| **yt_engine.py** | YouTube search & streaming via yt-dlp, video URL resolution, cookie support, caching |
| **saavn_engine.py** | JioSaavn API integration, encrypted URL decryption, enhanced search with artist filtering |
| **metadata_engine.py** | iTunes/Apple Music API integration, categorized search (songs/albums/artists), album/artist detail pages, video previews, curated category endpoints (Top 100, Hindi charts, etc.) |
| **cache_manager.py** | Smart caching with TTL and validation |

**API Endpoints:**
- `/api/search` - Categorized search (Songs, Albums, Artists)
- `/api/album/<id>` - Album tracks
- `/api/artist/<name>` - Artist songs & albums
- `/api/category/<id>` - Curated category songs
- `/api/play` - Get audio stream URL
- `/api/stream` - YouTube audio proxy with Range support
- `/api/video-preview` - iTunes video previews

**Security:**
- CORS protection with configurable origins
- Rate limiting (dev: 1000/min, prod: 200/hr)
- Security headers (CSP, X-Frame-Options, etc.)
- Input sanitization (query length limits, URL scheme stripping)

---

### Frontend Features (React)

| Feature | Description |
|---------|-------------|
| **Categorized Search** | Search results split into Songs, Albums, Artists tabs |
| **Clickable Albums & Artists** | Navigate to album detail and artist detail pages |
| **Sticky Music Player** | Persistent bottom player with play/pause, seek, volume |
| **Dark Mode** | Dark theme by default |
| **Responsive Design** | Mobile-friendly with TailwindCSS |
| **Home Page Sections** | Top 100, City Charts, Recent Hindi Releases, Popular Albums, Featured Categories, Made For You |
| **Recent Searches** | Store and display recent search history |
| **Playlist Management** | Create/manage playlists |
| **Error Handling** | Backend error states, player error states |
| **Loading States** | Skeleton loading cards |

---

### Music Source Priority
1. **JioSaavn** (Primary) - 320kbps direct streams
2. **YouTube** (Fallback) - Audio streaming via proxy

The app uses fuzzy matching to find the best audio match, with penalties for remixes/covers when originals are requested.
