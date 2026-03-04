import requests
from requests.exceptions import RequestException
import base64
import json
import re
import os
from pyDes import des, ECB, PAD_PKCS5
from cache_manager import smart_cache

# --- CONSTANTS ---
# DES key is read from the environment so it is never hard-coded in source.
# The default value is JioSaavn's public key (extracted from their web bundle),
# so there is no security loss if the env var is unset during local development.
_DES_KEY = os.getenv("SAAVN_DES_KEY", "38346591").encode("utf-8")
DES_CIPHER = des(_DES_KEY, ECB, pad=None, padmode=PAD_PKCS5)

# Better headers to avoid detection/blocking
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.jiosaavn.com/',
    'Origin': 'https://www.jiosaavn.com'
}

def decrypt_url(encrypted_url):
    try:
        enc_url = base64.b64decode(encrypted_url.strip())
        return DES_CIPHER.decrypt(enc_url, padmode=PAD_PKCS5).decode('utf-8')
    except: return None

def fix_json(text):
    try: return json.loads(text)
    except: return json.loads(re.sub(r'\(From "([^"]+)"\)', r"(From '\1')", text.strip()))

def fix_title(title):
    return title.replace("&quot;", '"').replace("&#039;", "'").replace("&amp;", "&")

# Bracket content that is just noise and should be stripped from the search query.
# Music-relevant content like [Remix], [Cover], [Acoustic] must NOT be removed.
_NOISE_BRACKETS = re.compile(
    r'\[(Official.*?|Music Video|Video|Audio|HD|HQ|4K|MV|Visualizer|Lyric.*?|Explicit)\]',
    re.IGNORECASE
)

def clean_saavn_query(query):
    """Simplifies the query for Saavn's search API."""
    # Remove symbols that choke Saavn's search
    q = query.replace('&', ' ').replace(',', ' ').replace(' - ', ' ')
    q = q.replace('(', ' ').replace(')', ' ').replace('@', ' ')
    # Only strip known non-music bracket content; keep [Remix], [Cover], [Acoustic], etc.
    q = _NOISE_BRACKETS.sub(' ', q)
    # Expand any remaining brackets so Saavn can tokenise the words inside
    q = q.replace('[', ' ').replace(']', ' ')
    return ' '.join(q.split())

@smart_cache(ttl=3600, validator=lambda x: x and len(x) > 0)
def search_saavn(query):
    """Searches JioSaavn and returns a list of 320kbps songs."""
    cleaned_query = clean_saavn_query(query)
    print(f"   [Saavn] Searching for: '{cleaned_query}'" + (f" (Original: '{query}')" if cleaned_query != query else ""))
    
    try:
        # 1. Try with cleaned query
        resp = requests.get("https://www.jiosaavn.com/api.php", params={
            "__call": "search.getResults", "_format": "json", "q": cleaned_query, "n": "10", "p": "1", "_marker": "0", "ctx": "web6dot0"
        }, headers=HEADERS, timeout=10)
        
        print(f"   [Saavn] Response status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"   [Saavn] Non-200 response: {resp.status_code} - {resp.text[:200]}")
            return []
        
        data = fix_json(resp.text)
        results = data.get('results') or data.get('data', {}).get('results')
        
        print(f"   [Saavn] Found {len(results) if results else 0} raw results")
        
        # 2. FALLBACK: If 0 results, try even simpler query (Title + First Artist)
        if not results and ('&' in query or ',' in query or 'feat' in query.lower() or 'ft.' in query.lower()):
            # Extract title and main artist (remove featured artist)
            # Handle patterns like "Title feat. Featured Artist Main Artist" or "Title (feat. Featured) Main Artist"
            lite_query = re.sub(r'\(feat\.?[^)]*\)|feat\.?[^,]*[,]|\(ft\.?[^)]*\)|ft\.?[^,]*[,]', '', query, flags=re.IGNORECASE)
            lite_query = lite_query.replace('(', ' ').replace(')', ' ')
            lite_query = ' '.join(lite_query.split())
            print(f"   [Saavn] No results. Trying Lite Search: '{lite_query}'")
            resp = requests.get("https://www.jiosaavn.com/api.php", params={
                "__call": "search.getResults", "_format": "json", "q": lite_query, "n": "10", "p": "1", "_marker": "0", "ctx": "web6dot0"
            }, headers=HEADERS, timeout=10)
            
            print(f"   [Saavn] Lite search status: {resp.status_code}")
            data = fix_json(resp.text)
            results = data.get('results') or data.get('data', {}).get('results')
            print(f"   [Saavn] Lite search found {len(results) if results else 0} results")

        if not results: 
            print(f"   [Saavn] No results found for any variant of query")
            return []

        songs = []
        for s in results:
            try:
                enc = s.get('encrypted_media_url')
                if enc:
                    # Decrypt and Upgrade to 320kbps
                    raw_url = decrypt_url(enc)
                    if not raw_url:
                        print(f"   [Saavn] Failed to decrypt URL for: {s.get('song', 'Unknown')}")
                        continue
                        
                    # Upgrade to 160kbps which is much safer than 320kbps for obscure tracks
                    hq_url = raw_url.replace("_96.mp4", "_160.mp4")
                    
                    #  PRIORITY: artistMap (performers) > subtitle > music (songwriters/composers)
                    artist = ""
                    
                    # 1. Try artistMap first.
                    # Saavn's artistMap groups: 'primary_artists', 'featured_artists', 'artists'.
                    # The 'artists' group contains SONGWRITERS / PRODUCERS — we skip it.
                    # We only want performers: primary + featured.
                    if s.get('artistMap'):
                        artists_list = s.get('artistMap', {})
                        if isinstance(artists_list, dict):
                            names = []
                            seen_lower = set()
                            for key in ('primary_artists', 'featured_artists'):
                                for a in artists_list.get(key, []):
                                    if isinstance(a, dict) and a.get('name'):
                                        n = a['name']
                                        if n.lower() not in seen_lower:
                                            names.append(n)
                                            seen_lower.add(n.lower())
                            if names:
                                artist = ', '.join(names)

                    # 2. Fallback: subtitle has performer names (e.g. "Post Malone, Morgan Wallen").
                    # Prefer it over `music`, which Saavn uses for SONGWRITERS.
                    if not artist:
                        artist = s.get('subtitle', '') or s.get('more_info', {}).get('primary_artists', '') or s.get('music', '')
                    
                    songs.append({
                        "title": fix_title(s['song']),
                        "artist": fix_title(artist),
                        "image": s.get('image', '').replace("150x150", "500x500"),
                        "url": hq_url,
                        "source": "saavn",
                        "quality": "320kbps"
                    })
            except Exception as e:
                print(f"   [Saavn] Error processing result: {e}")
                continue
        
        print(f"   [Saavn] Returning {len(songs)} songs")
        return songs
    except RequestException as e:
         print(f"   [Saavn] Connection Error: {e}")
         raise e
    except Exception as e:
        print(f"   [Saavn] Error: {e}")
        return []

# ---------------------------------------------------------
# ENHANCED SEARCH LOGIC (Based on User's Suggestion)
# ---------------------------------------------------------

# Keywords that indicate non-original tracks
JUNK_KEYWORDS = [
    "karaoke", "cover", "instrumental", "remix",
    "originally performed", "tribute", "vibe2vibe",
    "soundtrack wonder", "backing", "cover mix",
    "jersey club", "jersey remix", "jersey mix",
    "club mix", "club remix", "drill remix",
    "sped up", "slowed", "lofi", "lo-fi", "nightcore"
]

# Album image CDN priority (higher priority = lower rank number)
# Used to prefer Official Soundtracks for movie songs
IMAGE_PRIORITY = [
    "Spider-Man-Into-the-Spider-Verse-Soundtrack",   # rank 0 — official OST
    "Spider-Man-Into-the-Spider-Verse-Deluxe",       # rank 1 — deluxe OST
    "Hollywood",                                      # rank 2 — Post Malone's album
]

def is_junk(result: dict) -> bool:
    """Returns True if the result is a cover, karaoke, remix, etc."""
    title = result.get("title", "").lower()
    artist = result.get("artist", "").lower()
    return any(kw in title or kw in artist for kw in JUNK_KEYWORDS)

def rank_result(result: dict) -> int:
    """Lower score = better result. Ranks by album image URL priority."""
    image = result.get("image", "")
    for i, keyword in enumerate(IMAGE_PRIORITY):
        if keyword in image:
            return i
    return len(IMAGE_PRIORITY)  # lowest priority

def _artist_words_match(query_artist: str, track_artist_str: str) -> bool:
    """
    Word-level artist match. Returns True if ALL words of query_artist appear
    in the full track artist string (case-insensitive). This prevents 'al'
    from matching 'Alan Walker', while still matching 'alan walker' in
    'alan walker, isak' correctly.
    """
    q_words = set(re.sub(r"[^a-z0-9 ]", "", query_artist.lower()).split())
    t_words = set(re.sub(r"[^a-z0-9 ]", "", track_artist_str.lower()).split())
    return bool(q_words) and q_words.issubset(t_words)


def search_saavn_enhanced(query, artist_filter=None):
    """
    Clean search pipeline to find the original track based on title matching and artist scoring.
    """
    import difflib
    SEP = "·" * 50
    print(f"\n   {SEP}")
    print(f"   [Saavn+] 🔍 Query: '{query}', Artist Filter: {artist_filter}")

    # ── 1. Extract query_title and query_artist ───────────────
    query_lower = query.lower()
    query_artists = [a.strip().lower() for a in (artist_filter or []) if a]
    query_artist = query_artists[0] if query_artists else ""

    # Remove ALL known artist names from query to isolate the title
    # Use word-boundary regex so 'al' won't strip from 'alan'
    query_title = query_lower
    for qa in query_artists:
        # Build a safe word-boundary pattern from the artist name
        escaped = re.escape(qa)
        query_title = re.sub(rf'\b{escaped}\b', ' ', query_title, flags=re.IGNORECASE)

    # Clean up any leftover noise (trailing dashes, extra spaces)
    query_title = re.sub(r'[\-\:]', ' ', query_title)
    query_title = ' '.join(query_title.split()).strip()

    print(f"   [Saavn+] 🎯 Extracted Title: '{query_title}', Artist: '{query_artist}'")

    # ── 2. Fetch raw results ──────────────────────────────────
    raw_results = search_saavn(query)
    if not raw_results:
        print("   [Saavn+] ❌ No raw results from Saavn.")
        return []

    print(f"   [Saavn+] 📦 Raw results from Saavn ({len(raw_results)}):")
    for r in raw_results:
        print(f"      - '{r['title']}' — '{r['artist']}'")

    # ── 3. Score each result ──────────────────────────────────
    version_keywords = ['remix', 'mix', 'acoustic', 'cover', 'instrumental', 'slowed', 'sped', 'lofi', 'nightcore']
    # IMPORTANT: check the ORIGINAL query (not just query_title) so that
    # version info in brackets like [Joe Stone Remix] is still detected
    # even after the artist name has been stripped from query_title.
    query_wants_version = any(kw in query.lower() for kw in version_keywords)

    scored = []
    for track in raw_results:
        track_title = track["title"].lower()
        track_artist_str = track["artist"].lower()

        score = 0

        # ── PASS 1: Title matching ────────────────────────────
        track_has_version = any(kw in track_title for kw in version_keywords)
        if track_has_version and not query_wants_version:
            score -= 50
        elif not track_has_version and query_wants_version:
            score -= 50

        if track_title == query_title:
            score += 100
        elif query_title and query_title in track_title:
            # Partial containment — penalise proportional to extra length
            extra_ratio = len(track_title) / max(len(query_title), 1)
            score += max(20, int(50 / extra_ratio))
        else:
            ratio = difflib.SequenceMatcher(None, query_title, track_title).ratio()
            score += int(ratio * 40)

        # ── PASS 2: Artist matching ───────────────────────────
        if query_artist:
            if _artist_words_match(query_artist, track_artist_str):
                score += 50
                # Extra boost if primary artist (first in the comma-separated list)
                primary_artist = re.split(r'[,&]', track_artist_str)[0].strip()
                if _artist_words_match(query_artist, primary_artist):
                    score += 50
            else:
                # Artist specified but not found — strong penalty
                score -= 150

        # Extra reward if ALL query artists appear in the track
        if len(query_artists) > 1:
            matches = sum(1 for qa in query_artists if _artist_words_match(qa, track_artist_str))
            score += matches * 20

        # ── PASS 3: Cover / karaoke artist penalties ──────────
        cover_kws = ["cover", "tribute", "karaoke", "we rabbitz", "romy wave",
                     "robert mendoza", "lemongrass", "vibe2vibe"]
        if any(kw in track_artist_str for kw in cover_kws) and "cover" not in query.lower():
            score -= 80

        # ── PASS 4: Title-based junk keywords ────────────────
        if is_junk(track) and not query_wants_version:
            score -= 60

        # ── PASS 5: Image / album priority (tie-breaker) ──────
        score -= rank_result(track) * 2

        scored.append({"track": track, "score": score})

    scored.sort(key=lambda x: x["score"], reverse=True)

    # ── 4. Logging ────────────────────────────────────────────
    print(f"\n   [Saavn+] 📊 Ranked results after full evaluation:")
    for i, r in enumerate(scored[:6]):
        marker = "🥇" if i == 0 else f"#{i+1}"
        print(f"   {marker}  Score: {r['score']}")
        print(f"        '{r['track']['title']}' — '{r['track']['artist']}'")

    # ── 5. Filter: only keep results that cleared the bar ─────
    # For remix/version queries the artist match is looser (the remixer may not
    # be in artist_filter), so we use a softer threshold (-100 vs -50).
    threshold = -100 if query_wants_version else -50
    final_results = [r["track"] for r in scored if r["score"] > threshold]

    if final_results:
        best = final_results[0]
        print(f"\n   [Saavn+] ✅ WINNER: '{best['title']}' — '{best['artist']}'")
    else:
        print(f"\n   [Saavn+] ❌ No results cleared threshold. Falling back to raw results.")
        final_results = raw_results  # Safety net — never return empty if Saavn had anything
    print(f"   {SEP}\n")

    return final_results





def download_saavn_file(url, path):
    """Directly downloads MP4 from Saavn CDN"""
    local_filename = os.path.join(path, f"saavn_{os.urandom(4).hex()}.mp4")
    with requests.get(url, stream=True, headers=HEADERS, timeout=10) as r:
        r.raise_for_status()
        with open(local_filename, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192): f.write(chunk)
    return local_filename