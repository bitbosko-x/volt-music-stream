import os
import threading
from .engines import metadata as metadata_engine
from .engines import saavn as saavn_engine
from .engines import youtube as yt_engine
import difflib
import re
from requests.exceptions import RequestException

# In-memory cache: search_term → saavn_id
# Populated in the background after search; consumed at play time.
_SAAVN_ID_CACHE: dict[str, str] = {}

DOWNLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'downloads')

def _find_best_match(results, search_term):
    """
    Finds the result that best matches the search term using fuzzy string matching.
    """
    if not results:
        return None
        
    search_term = search_term.lower()
    best_result = None
    best_ratio = 0.0
    
    print(f"   [Hub] Finding best match for: '{search_term}'")
    
    for res in results:
        if not res.get('artist') or not res['artist'].strip():
             print(f"      - [Hub] Skipping result with empty artist: '{res.get('title')}'")
             continue

        def clean_str(s):
            s = s.lower()
            for x in ['feat.', 'feat', 'featuring', '&', ',', 'dashed']:
                s = s.replace(x, '')
            return ' '.join(s.split())

        res_string = f"{res['title']} {res['artist']}".lower()
        clean_search = clean_str(search_term)
        clean_res = clean_str(res_string)
        
        sorted_search = ' '.join(sorted(clean_search.split()))
        sorted_res = ' '.join(sorted(clean_res.split()))
        
        if sorted_search in sorted_res or sorted_res in sorted_search:
             ratio = 0.9
             ratio = max(ratio, difflib.SequenceMatcher(None, sorted_search, sorted_res).ratio())
        else:
             ratio = difflib.SequenceMatcher(None, clean_search, clean_res).ratio()
             try:
                 artists = re.split(r',|&|feat\.|feat', res['artist'])
                 if len(artists) > 1:
                     query_words = set(search_term.lower().split())
                     matching_artists = []
                     for artist in artists:
                         artist_words = set(artist.lower().split())
                         if artist_words & query_words:
                             matching_artists.append(artist)
                     if matching_artists:
                         short_artist = ' '.join(matching_artists)
                     else:
                         short_artist = ' '.join(artists[:2])
                     short_res_string = f"{res['title']} {short_artist}".lower()
                     clean_short = clean_str(short_res_string)
                     ratio_short = difflib.SequenceMatcher(None, clean_search, clean_short).ratio()
                     ratio = max(ratio, ratio_short)
                     print(f"      - Shortened comparison vs '{clean_short}' -> Score: {ratio_short:.2f}")
             except Exception as e:
                 print(f"DEBUG: Error splitting artists: {e}")
        
        print(f"      - Comparing vs '{clean_res}' -> Score: {ratio:.2f}")
        
        version_keywords = ['remix', 'mix', 'acoustic', 'cover', 'tribute', 'version', 'edit', 'instrumental']
        query_has_version = any(keyword in search_term.lower() for keyword in version_keywords)
        result_has_version = any(keyword in res['title'].lower() for keyword in version_keywords)
        
        if result_has_version and not query_has_version:
            penalty = 0.15
            ratio = max(0, ratio - penalty)
            print(f"      - Version penalty applied -> Adjusted: {ratio:.2f}")
        
        if ratio > best_ratio:
            best_ratio = ratio
            best_result = res
            
    if best_ratio < 0.35:
        print(f"   [Hub] Best match score ({best_ratio:.2f}) is too low. Skipping Saavn.")
        return None
        
    print(f"   [Hub] Selected Best Match: '{best_result['title']}' ({best_ratio:.2f})")
    return best_result

def get_audio_link(search_term, artist_name=None, saavn_id=None):
    """
    Resolves an audio stream for the given song.
    Fast path: if saavn_id is provided (pre-resolved at search time), fetch by ID directly —
    no text matching, zero drift.
    Slow path: fuzzy Saavn search → YouTube fallback.
    """
    SEP = "─" * 55
    print(f"\n{SEP}")
    print(f"🎵 [PIPELINE] STEP 1 — Query received")
    print(f"   Search Term : {search_term!r}")
    print(f"   Artist Hint : {artist_name!r}")
    print(f"   Saavn ID    : {saavn_id!r}")
    print(SEP)

    # ── FAST PATH: direct Saavn ID lookup (100% accurate, no text matching) ──
    # Accept ID from the frontend OR from the background pre-resolution cache.
    resolved_id = saavn_id or _SAAVN_ID_CACHE.get(search_term)
    if resolved_id:
        source_label = "frontend" if saavn_id else "bg-cache"
        print(f"\n⚡ [PIPELINE] FAST PATH — Saavn ID '{resolved_id}' (via {source_label})")
        url = saavn_engine.get_stream_by_saavn_id(resolved_id)
        if url:
            print(f"   ✅ Direct ID resolved — zero drift guaranteed")
            print(SEP + "\n")
            return url, 'saavn'
        print(f"   ⚠️  ID lookup failed, falling back to text search")

    artist_filter = [artist_name] if artist_name else None
    saavn_results = []
    try:
        print(f"\n🔍 [PIPELINE] STEP 2 — Searching JioSaavn …")
        saavn_results = saavn_engine.search_saavn_enhanced(search_term, artist_filter=artist_filter)
        print(f"   Saavn returned {len(saavn_results)} usable result(s) after filtering/ranking")
    except Exception as e:
        print(f"   ⚠️  Saavn search failed: {e}")

    best_match = None
    if saavn_results:
        print(f"\n🏆 [PIPELINE] STEP 3 — Top Saavn candidates (ranked best → worst):")
        for i, r in enumerate(saavn_results[:5]):
            marker = "✅ SELECTED" if i == 0 else f"   #{i+1}"
            has_url = "✓ has stream URL" if r.get('url') else "✗ no stream URL"
            print(f"   {marker}  '{r['title']}' — {r['artist']}  ({has_url})")

        # Title similarity gate — reject the Saavn winner if its title is too
        # different from what was actually requested, so we fall back to YouTube
        # rather than playing a completely wrong song.
        candidate = saavn_results[0]
        _clean_query = search_term.lower()
        for _a in re.split(r'[,&]|\bfeat\.?\b|\bft\.?\b', (artist_name or '').lower()):
            _a = _a.strip()
            if _a:
                _clean_query = re.sub(r'\b' + re.escape(_a) + r'\b', '', _clean_query)
        _clean_query = re.sub(r'\([^)]*\)|\[[^\]]*\]', '', _clean_query)
        _clean_query = re.sub(r'[&,]', ' ', _clean_query)  # drop separator chars left after artist removal
        _clean_query = ' '.join(_clean_query.split())
        _clean_result = re.sub(r'\([^)]*\)|\[[^\]]*\]', '', candidate['title'].lower())
        _clean_result = ' '.join(_clean_result.split())
        _title_sim = difflib.SequenceMatcher(None, _clean_query, _clean_result).ratio()
        print(f"\n   Title gate: '{_clean_query}' vs '{_clean_result}' → {_title_sim:.2f}")
        if _title_sim >= 0.40:
            best_match = candidate
            print(f"   Winner: '{best_match['title']}' by '{best_match['artist']}'")
        else:
            print(f"   ⚠️  Title similarity too low ({_title_sim:.2f}) — discarding, falling back to YouTube")
    else:
        print(f"\n   ⚠️  [PIPELINE] STEP 3 — No Saavn results. Jumping to YouTube fallback.")

    if best_match:
        if best_match.get('url'):
            print(f"\n🔗 [PIPELINE] STEP 4 — Stream URL resolved via Saavn")
            print(f"   Source  : JioSaavn")
            print(f"   URL     : {best_match['url'][:80]}…")
            print(f"\n✅ [PIPELINE] DONE — Sending Saavn stream to player")
            print(SEP + "\n")
            return best_match['url'], 'saavn'
        else:
            print(f"\n   ⚠️  [PIPELINE] STEP 4 — Best Saavn match has no stream URL. Falling back to YouTube.")

    print(f"\n🎬 [PIPELINE] STEP 5 — Trying YouTube fallback …")
    yt_query = f"{search_term} Audio"
    print(f"   YouTube Query: {yt_query!r}")
    yt_results = yt_engine.search_youtube(yt_query)

    if yt_results:
        first = yt_results[0]
        print(f"   YouTube top result: '{first['title']}'")
        stream_url = yt_engine.resolve_yt_stream(first['url'])
        if stream_url:
            print(f"   Stream URL: {stream_url[:80]}…")
            print(f"\n✅ [PIPELINE] DONE — Sending YouTube stream to player")
            print(SEP + "\n")
            return stream_url, 'youtube'

    print(f"\n❌ [PIPELINE] FAILED — No stream found from either source")
    print(SEP + "\n")
    return None, None


def _resolve_song_ids_background(songs, max_songs=8):
    """
    Fire-and-forget: resolves Saavn IDs for the top N songs and stores them
    in _SAAVN_ID_CACHE keyed by search_term.  Runs in a daemon thread so it
    never blocks the search response.  By the time the user clicks play
    (typically 1-5 s later) the IDs are ready.
    """
    def _worker():
        targets = songs[:max_songs]
        print(f"--- HUB: [BG] Resolving Saavn IDs for {len(targets)} songs ---")
        for song in targets:
            key = song.get('search_term', '')
            if not key or key in _SAAVN_ID_CACHE:
                continue
            try:
                artist = song.get('artist', '')
                results = saavn_engine.search_saavn_enhanced(
                    key,
                    artist_filter=[artist] if artist else None,
                )
                if results and results[0].get('id'):
                    _SAAVN_ID_CACHE[key] = results[0]['id']
                    print(f"--- HUB: [BG] ✓ {key[:50]!r} → {results[0]['id']}")
            except Exception as e:
                print(f"--- HUB: [BG] ✗ {key[:50]!r}: {e}")

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def search_hybrid(user_query, categorized=True, offset=0):
    """
    Search for music content.
    Songs in the result include 'saavn_id' pre-resolved so play requests
    can skip text matching entirely and use direct ID lookup.
    """
    print(f"--- HUB: Processing '{user_query}' (offset: {offset}) ---")

    if categorized:
        try:
            results = metadata_engine.search_metadata_categorized(user_query, offset=offset)
            if results['songs'] or results['albums'] or results['artists']:
                print(f"--- HUB: Found categorized results ---")
                print(f"   Songs: {len(results['songs'])}, Albums: {len(results['albums'])}, Artists: {len(results['artists'])}")
                _resolve_song_ids_background(results['songs'])
                return results
        except RequestException as e:
            print(f"--- HUB: Metadata search failed (connection error): {e}")
            print("--- HUB: Falling back to raw search engine. ---")
        except Exception as e:
            print(f"--- HUB: Metadata search failed (unexpected): {e}")
            print("--- HUB: Falling back to raw search engine. ---")
        
        print("--- HUB: Metadata unavailable. Using raw search fallback. ---")
        clean_query = yt_engine.smart_autocorrect(user_query)
        fallback_songs = saavn_engine.search_saavn(clean_query)
        for song in fallback_songs:
            if not song.get('search_term'):
                song['search_term'] = f"{song.get('title', '')} {song.get('artist', '')}".strip()
        return {"songs": fallback_songs, "albums": [], "artists": [], "playlists": []}
    else:
        try:
            results = metadata_engine.search_metadata(user_query)
            if results:
                print(f"--- HUB: Found {len(results)} results on Apple Music ---")
                return results
        except Exception as e:
            print(f"--- HUB: Metadata search failed: {e}")
        
        print("--- HUB: Metadata unavailable. Using raw search. ---")
        clean_query = yt_engine.smart_autocorrect(user_query)
        fallback_songs = saavn_engine.search_saavn(clean_query)
        for song in fallback_songs:
            if not song.get('search_term'):
                song['search_term'] = f"{song.get('title', '')} {song.get('artist', '')}".strip()
        return fallback_songs

def download_song(url, source):
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    print(f"--- HUB: Downloading from {source} ---")
    if source == 'saavn':
        return saavn_engine.download_saavn_file(url, DOWNLOAD_DIR)
    elif source == 'yt':
        return yt_engine.download_yt_file(url, DOWNLOAD_DIR)
    return None

def get_video_preview(search_term, artist=None):
    """Finds a video preview (YT stream) for a song."""
    print(f"   [Hub] Finding Video Preview for: {search_term}")
    query = f"{search_term} Official Video"
    if artist:
        query = f"{search_term} {artist} Official Video"
    video_url = yt_engine.get_video_url(query)
    if video_url:
        print("   [Hub] Found Video URL!")
        return video_url
    return None
