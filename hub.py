import os
import metadata_engine
import saavn_engine
import yt_engine
import difflib
import re
from requests.exceptions import RequestException

DOWNLOAD_DIR = os.path.join(os.getcwd(), 'downloads')

def _find_best_match(results, search_term):
    """
    Finds the result that best matches the search term using fuzzy string matching.
    Returns the best matching result object or None if no good match found.
    """
    if not results:
        return None
        
    search_term = search_term.lower()
    best_result = None
    best_ratio = 0.0
    
    print(f"   [Hub] Finding best match for: '{search_term}'")
    
    for res in results:
        # SKIP empty artists (likely bad metadata/user uploads)
        if not res.get('artist') or not res['artist'].strip():
             print(f"      - [Hub] Skipping result with empty artist: '{res.get('title')}'")
             continue

        # Clean strings for better matching
        def clean_str(s):
            s = s.lower()
            # Remove common junk
            for x in ['feat.', 'feat', 'featuring', '&', ',', 'dashed']:
                s = s.replace(x, '')
            return ' '.join(s.split())

        # Construct comparison string from result
        res_string = f"{res['title']} {res['artist']}".lower()

        clean_search = clean_str(search_term)
        clean_res = clean_str(res_string)
        
        # 2. Token Sort Ratio (Handles word reordering)
        # "Selena Gomez Marshmello" vs "Marshmello Selena Gomez"
        sorted_search = ' '.join(sorted(clean_search.split()))
        sorted_res = ' '.join(sorted(clean_res.split()))
        
        # Check strict inclusion on SORTED strings
        if sorted_search in sorted_res or sorted_res in sorted_search:
             ratio = 0.9
             ratio = max(ratio, difflib.SequenceMatcher(None, sorted_search, sorted_res).ratio())
        else:
             # Fallback to standard fuzzy
             ratio = difflib.SequenceMatcher(None, clean_search, clean_res).ratio()
             
             # 3. Truncated Artist Check (for long artist lists)
             # Result might be "Wolves - Marshmello, Selena Gomez, Andrew Wotman..."
             # We try matching against "Wolves - Marshmello, Selena Gomez"
             try:
                 # Split artist by common separators
                 artists = re.split(r',|&|feat\.|feat', res['artist'])
                 if len(artists) > 1:
                     # Smart selection: find artists that match query terms
                     query_words = set(search_term.lower().split())
                     matching_artists = []
                     for artist in artists:
                         artist_words = set(artist.lower().split())
                         # If any artist word appears in query, it's a match
                         if artist_words &query_words:
                             matching_artists.append(artist)
                     
                     # Use matching artists if found, otherwise fall back to first 2
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
        
        # 4. Version Preference: Penalize remixes/acoustic/covers when not requested
        version_keywords = ['remix', 'mix', 'acoustic', 'cover', 'tribute', 'version', 'edit', 'instrumental']
        query_has_version = any(keyword in search_term.lower() for keyword in version_keywords)
        result_has_version = any(keyword in res['title'].lower() for keyword in version_keywords)
        
        if result_has_version and not query_has_version:
            # Apply penalty to non-original versions when user didn't request them
            penalty = 0.15
            ratio = max(0, ratio - penalty)
            print(f"      - Version penalty applied (remix/acoustic/cover not requested) -> Adjusted: {ratio:.2f}")
        
        if ratio > best_ratio:
            best_ratio = ratio
            best_result = res
            
    # Threshold: Lowered to 0.35 to catch valid matches with extra artist info
    if best_ratio < 0.35:
        print(f"   [Hub] Best match score ({best_ratio:.2f}) is too low. Skipping Saavn.")
        return None
        
    print(f"   [Hub] Selected Best Match: '{best_result['title']}' ({best_ratio:.2f})")
    return best_result

def get_audio_link(search_term, artist_name=None):
    """
    Takes the clean string from Apple (e.g. 'Starboy The Weeknd')
    and matches it to a real audio file.
    """
    SEP = "─" * 55
    print(f"\n{SEP}")
    print(f"🎵 [PIPELINE] STEP 1 — Query received")
    print(f"   Search Term : {search_term!r}")
    print(f"   Artist Hint : {artist_name!r}")
    print(SEP)

    # ── STEP 2: JioSaavn Enhanced Search ─────────────────────
    artist_filter = [artist_name] if artist_name else None
    saavn_results = []
    try:
        print(f"\n🔍 [PIPELINE] STEP 2 — Searching JioSaavn …")
        saavn_results = saavn_engine.search_saavn_enhanced(search_term, artist_filter=artist_filter)
        print(f"   Saavn returned {len(saavn_results)} usable result(s) after filtering/ranking")
    except Exception as e:
        print(f"   ⚠️  Saavn search failed: {e}")

    # ── STEP 3: Select best ranked result ────────────────────
    best_match = None
    if saavn_results:
        print(f"\n🏆 [PIPELINE] STEP 3 — Top Saavn candidates (ranked best → worst):")
        for i, r in enumerate(saavn_results[:5]):
            marker = "✅ SELECTED" if i == 0 else f"   #{i+1}"
            has_url = "✓ has stream URL" if r.get('url') else "✗ no stream URL"
            print(f"   {marker}  '{r['title']}' — {r['artist']}  ({has_url})")
        best_match = saavn_results[0]
        print(f"\n   Winner: '{best_match['title']}' by '{best_match['artist']}'")
    else:
        print(f"\n   ⚠️  [PIPELINE] STEP 3 — No Saavn results. Jumping to YouTube fallback.")

    # ── STEP 4: Resolve stream URL ────────────────────────────
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

    # ── STEP 5: YouTube fallback ──────────────────────────────
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


def search_hybrid(user_query, categorized=True, offset=0):
    """
    Search for music content.
    
    Args:
        user_query: Search term
        categorized: If True, returns categorized dict. If False, returns flat list (legacy)
        offset: Number of results to skip for pagination (default: 0)
    
    Returns:
        If categorized=True: {"songs": [], "albums": [], "artists": [], "playlists": []}
        If categorized=False: Flat list of results (legacy)
    """
    print(f"--- HUB: Processing '{user_query}' (offset: {offset}) ---")
    
    if categorized:
        # NEW: Return categorized results from iTunes
        try:
            results = metadata_engine.search_metadata_categorized(user_query, offset=offset)
            
            if results['songs'] or results['albums'] or results['artists']:
                print(f"--- HUB: Found categorized results ---")
                print(f"   Songs: {len(results['songs'])}, Albums: {len(results['albums'])}, Artists: {len(results['artists'])}")
                return results
        except RequestException as e:
            print(f"--- HUB: Metadata search failed (connection error): {e}")
            print("--- HUB: Falling back to raw search engine. ---")
        except Exception as e:
            print(f"--- HUB: Metadata search failed (unexpected): {e}")
            print("--- HUB: Falling back to raw search engine. ---")
        
        # Fallback: Use raw search if iTunes finds nothing OR fails
        print("--- HUB: Metadata unavailable. Using raw search fallback. ---")
        clean_query = yt_engine.smart_autocorrect(user_query)
        fallback_songs = saavn_engine.search_saavn(clean_query)
        return {
            "songs": fallback_songs,
            "albums": [],
            "artists": [],
            "playlists": []
        }
    else:
        # LEGACY: Flat list for backward compatibility
        try:
            results = metadata_engine.search_metadata(user_query)
            
            if results:
                print(f"--- HUB: Found {len(results)} results on Apple Music ---")
                return results
        except Exception as e:
             print(f"--- HUB: Metadata search failed: {e}")
        
        # STRATEGY 2: Fallback (if iTunes finds nothing)
        print("--- HUB: Metadata unavailable. Using raw search. ---")
        clean_query = yt_engine.smart_autocorrect(user_query)
        return saavn_engine.search_saavn(clean_query)

def download_song(url, source):
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    print(f"--- HUB: Downloading from {source} ---")
    if source == 'saavn':
        return saavn_engine.download_saavn_file(url, DOWNLOAD_DIR)
    elif source == 'yt':
        return yt_engine.download_yt_file(url, DOWNLOAD_DIR)
    return None

def get_video_preview(search_term, artist=None):
    """
    Finds a video preview (YT stream) for a song.
    """
    print(f"   [Hub] Finding Video Preview for: {search_term}")
    
    # Construct a video-specific query
    query = f"{search_term} Official Video"
    if artist:
        query = f"{search_term} {artist} Official Video"
        
    video_url = yt_engine.get_video_url(query)
    
    if video_url:
        print("   [Hub] Found Video URL!")
        return video_url
        
    return None