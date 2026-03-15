import requests
from requests.exceptions import RequestException
import base64
import json
import re
import os
from pyDes import des, ECB, PAD_PKCS5
from .cache import smart_cache

# --- CONSTANTS ---
_DES_KEY = os.getenv("SAAVN_DES_KEY", "38346591").encode("utf-8")
DES_CIPHER = des(_DES_KEY, ECB, pad=None, padmode=PAD_PKCS5)

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

_NOISE_BRACKETS = re.compile(
    r'\[(Official.*?|Music Video|Video|Audio|HD|HQ|4K|MV|Visualizer|Lyric.*?|Explicit)\]',
    re.IGNORECASE
)

def clean_saavn_query(query):
    """Simplifies the query for Saavn's search API."""
    q = query.replace('&', ' ').replace(',', ' ').replace(' - ', ' ')
    q = q.replace('(', ' ').replace(')', ' ').replace('@', ' ')
    q = _NOISE_BRACKETS.sub(' ', q)
    q = q.replace('[', ' ').replace(']', ' ')
    return ' '.join(q.split())

@smart_cache(ttl=3600, validator=lambda x: x and len(x) > 0)
def search_saavn(query):
    """Searches JioSaavn and returns a list of 320kbps songs."""
    cleaned_query = clean_saavn_query(query)
    print(f"   [Saavn] Searching for: '{cleaned_query}'" + (f" (Original: '{query}')" if cleaned_query != query else ""))
    
    try:
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
        
        if not results and ('&' in query or ',' in query or 'feat' in query.lower() or 'ft.' in query.lower()):
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
                    raw_url = decrypt_url(enc)
                    if not raw_url:
                        print(f"   [Saavn] Failed to decrypt URL for: {s.get('song', 'Unknown')}")
                        continue
                        
                    hq_url = raw_url.replace("_96.mp4", "_160.mp4")
                    
                    artist = ""
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


@smart_cache(ttl=3600, validator=lambda x: x and len(x) > 0)
def search_saavn_all(query):
    """
    Uses Saavn's search.getAll endpoint — the same API the Saavn website/app
    uses internally.
    """
    cleaned_query = clean_saavn_query(query)
    print(f"   [Saavn/All] Searching: '{cleaned_query}'")
    try:
        resp = requests.get(
            "https://www.jiosaavn.com/api.php",
            params={
                "__call": "search.getAll",
                "_format": "json",
                "q": cleaned_query,
                "_marker": "0",
                "ctx": "web6dot0",
            },
            headers=HEADERS,
            timeout=10,
        )
        if resp.status_code != 200:
            print(f"   [Saavn/All] Non-200: {resp.status_code}")
            return []

        data = fix_json(resp.text)

        song_section = (
            data.get("songs") or
            data.get("song") or
            data.get("data", {}).get("songs") or
            data.get("data", {}).get("song") or {}
        )
        results = song_section.get("data") or []

        if not results:
            tq = data.get("topquery") or data.get("data", {}).get("topquery") or {}
            tq_data = tq.get("data") or []
            results = [r for r in tq_data if r.get("type", "") == "song" or r.get("encrypted_media_url")]

        if not results:
            print(f"   [Saavn/All] No song section. Top-level keys: {list(data.keys())}")
            return []

        print(f"   [Saavn/All] Got {len(results)} editorial result(s)")
        songs = []
        for s in results:
            try:
                enc = s.get("encrypted_media_url")
                if not enc:
                    continue
                raw_url = decrypt_url(enc)
                if not raw_url:
                    continue
                hq_url = raw_url.replace("_96.mp4", "_160.mp4")

                artist = ""
                if s.get("artistMap"):
                    artists_list = s["artistMap"]
                    if isinstance(artists_list, dict):
                        names = []
                        seen_lower = set()
                        for key in ("primary_artists", "featured_artists"):
                            for a in artists_list.get(key, []):
                                if isinstance(a, dict) and a.get("name"):
                                    n = a["name"]
                                    if n.lower() not in seen_lower:
                                        names.append(n)
                                        seen_lower.add(n.lower())
                        if names:
                            artist = ", ".join(names)
                if not artist:
                    artist = (
                        s.get("subtitle", "") or
                        s.get("more_info", {}).get("primary_artists", "") or
                        s.get("music", "")
                    )

                songs.append({
                    "title":  fix_title(s.get("song", s.get("title", ""))),
                    "artist": fix_title(artist),
                    "image":  s.get("image", "").replace("150x150", "500x500"),
                    "url":    hq_url,
                    "source": "saavn",
                    "quality": "320kbps",
                })
            except Exception as e:
                print(f"   [Saavn/All] Error processing result: {e}")
                continue

        print(f"   [Saavn/All] Returning {len(songs)} song(s)")
        return songs

    except RequestException as e:
        print(f"   [Saavn/All] Connection error: {e}")
        raise e
    except Exception as e:
        print(f"   [Saavn/All] Error: {e}")
        return []


# ---------------------------------------------------------
# ENHANCED SEARCH LOGIC
# ---------------------------------------------------------

JUNK_KEYWORDS = [
    "karaoke", "cover", "instrumental", "remix",
    "originally performed", "tribute", "vibe2vibe",
    "soundtrack wonder", "backing", "cover mix",
    "jersey club", "jersey remix", "jersey mix",
    "club mix", "club remix", "drill remix",
    "sped up", "slowed", "lofi", "lo-fi", "nightcore",
    "melody karaoke", "fitness version", "for babies",
    "piano version", "string version", "lullaby"
]

ARTIST_ALIASES = {
    "diplo":          ["thomas wesley pentz", "thomas pentz jr", "thomas pentz"],
    "marshmello":     ["christopher comstock"],
    "deadmau5":       ["joel zimmerman"],
    "skrillex":       ["sonny john moore"],
    "lsd":            ["labrinth", "sia", "diplo"],
    "k-391":          ["kenneth nilsen"],
    "alan walker":    ["alan olav walker"],
    "kygo":           ["kyrre gorvell-dahll"],
    "avicii":         ["tim bergling"],
    "swedish house mafia": ["axwell", "steve angello", "sebastian ingrosso"],
    "post malone":    ["austin post", "austin richard post"],
    "kodak black":    ["bill k. kapri", "bill kapri", "dieuson octave"],
    "koe wetzel":     ["ropyr wetzel"],
    "juice wrld":     ["jarad higgins"],
    "xxxtentacion":   ["jahseh onfroy"],
    "roddy ricch":    ["rodrick moore"],
    "lil uzi vert":   ["symere woods"],
    "6ix9ine":        ["daniel hernandez"],
    "dababy":         ["jonathan kirk"],
    "pnb rock":       ["rakim allen"],
    "mgk":            ["colson baker"],
    "machine gun kelly": ["colson baker"],
    "travis scott":   ["jacques bermon webster", "jacques webster"],
    "ozzy osbourne":  ["john michael osbourne"],
    "sia":            ["sia furler", "sia kate isobelle furler"],
    "pink":           ["alecia moore"],
    "p!nk":           ["alecia moore"],
    "lorde":          ["ella yelich-o'connor"],
    "bebe rexha":     ["bleta rexha"],
    "luke combs":     ["lucas albert combs"],
    "morgan wallen":  ["morgan cole wallen"],
    "bts":            ["bangtan sonyeondan"],
    "the weeknd":     ["abel tesfaye"],
    "billie eilish":  ["billie eilish pirate baird o'connell"],
}

def _resolve_aliases(name):
    name_l = name.lower().strip()
    if name_l in ARTIST_ALIASES:
        return [name_l] + [a.lower() for a in ARTIST_ALIASES[name_l]]
    for stage, aliases in ARTIST_ALIASES.items():
        if name_l in [a.lower() for a in aliases]:
            return [stage] + [a.lower() for a in aliases]
    return [name_l]


def _has_dup_artist_name(artist_str):
    parts = [p.strip().lower() for p in re.split(r',|&', artist_str) if p.strip()]
    # Only penalize if the exact same artist NAME appears 3+ times,
    # as 2 times is common in Bollywood metadata (e.g., "Atif Aslam, Atif Aslam")
    for part in parts:
        if parts.count(part) >= 3:
            return True
    return False

IMAGE_PRIORITY = [
    "Spider-Man-Into-the-Spider-Verse-Soundtrack",
    "Spider-Man-Into-the-Spider-Verse-Deluxe",
    "Hollywood",
]

def is_junk(result):
    title = result.get("title", "").lower()
    artist = result.get("artist", "").lower()
    return any(kw in title or kw in artist for kw in JUNK_KEYWORDS)

def rank_result(result):
    image = result.get("image", "")
    for i, keyword in enumerate(IMAGE_PRIORITY):
        if keyword in image:
            return i
    return len(IMAGE_PRIORITY)

def _artist_words_match(query_artist: str, track_artist_str: str) -> bool:
    q_words = set(re.sub(r"[^a-z0-9 ]", "", query_artist.lower()).split())
    t_words = set(re.sub(r"[^a-z0-9 ]", "", track_artist_str.lower()).split())

    if bool(q_words) and q_words.issubset(t_words):
        return True

    for variant in _resolve_aliases(query_artist):
        v_words = set(re.sub(r"[^a-z0-9 ]", "", variant).split())
        if v_words and v_words.issubset(t_words):
            return True

    return False


def search_saavn_enhanced(query, artist_filter=None, album_name=None):
    """
    Cleans the query, calls either search.getResults or search.getAll, 
    and applies heavy ranking so covers/remixes are downvoted 
    and the correct original version is prioritized.
    """
    import difflib
    from statistics import median
    SEP = "·" * 50
    print(f"\n   {SEP}")
    print(f"   [Saavn+] 🔍 Query: '{query}', Artist Filter: {artist_filter}")

    query_lower = query.lower()

    _raw_filter = artist_filter or []
    _split_artists = []
    for af in _raw_filter:
        parts = re.split(r'\s*[,&]\s*|\s+feat\.?\s+|\s+ft\.?\s+', af, flags=re.IGNORECASE)
        _split_artists.extend([p.strip() for p in parts if p.strip()])
    query_artists = [a.lower() for a in _split_artists if a]
    query_artist = query_artists[0] if query_artists else ""

    query_title = query_lower
    for qa in query_artists:
        escaped = re.escape(qa)
        query_title = re.sub(rf'\b{escaped}\b', ' ', query_title, flags=re.IGNORECASE)

    query_title = re.sub(r'\(feat\.?[^)]*\)', ' ', query_title, flags=re.IGNORECASE)
    query_title = re.sub(r'\(ft\.?[^)]*\)', ' ', query_title, flags=re.IGNORECASE)
    query_title = re.sub(r'feat\.?\s+\S+', ' ', query_title, flags=re.IGNORECASE)
    query_title = re.sub(r'\(from\s+[^)]+\)', ' ', query_title, flags=re.IGNORECASE)
    query_title = re.sub(r'[\-\:\,\&\(\)]', ' ', query_title)
    query_title = ' '.join(query_title.split()).strip()

    print(f"   [Saavn+] 🎯 Extracted Title: '{query_title}', Artist: '{query_artist}'")

    feat_match = re.search(r'\(feat\.?\s+([^)]+)\)', query, flags=re.IGNORECASE)
    feat_artists = []
    if feat_match:
        feat_str = feat_match.group(1)
        feat_artists = [
            a.strip().lower()
            for a in re.split(r'[,&]', feat_str)
            if a.strip()
        ]
        if feat_artists:
            print(f"   [Saavn+] 🎤 Featured artists detected: {feat_artists}")

    clean_search = f"{query_title} {query_artist}".strip()
    raw_results = []
    
    # 1. Try multi-artist query if applicable
    if len(query_artists) > 1:
        all_artists_search = f"{query_title} {' '.join(query_artists[:3])}".strip()
        print(f"   [Saavn+] 🔍 Trying multi-artist query: '{all_artists_search}'…")
        multi = search_saavn_all(all_artists_search)
        if not multi: multi = search_saavn(all_artists_search)
        raw_results.extend(multi)

    # 2. Try single primary-artist query
    print(f"   [Saavn+] 🔍 Trying primary clean query: '{clean_search}'…")
    clean_res = search_saavn_all(clean_search)
    if not clean_res: clean_res = search_saavn(clean_search)
    raw_results.extend(clean_res)

    # Deduplicate by URL
    seen_urls = set()
    unique_results = []
    for r in raw_results:
        if r['url'] not in seen_urls:
            unique_results.append(r)
            seen_urls.add(r['url'])
    raw_results = unique_results

    # 3. Last resort full original query
    if not raw_results:
        print("   [Saavn+] ↩️  Both searches empty. Trying full original query…")
        raw_results = search_saavn(query)

    if not raw_results:
        print("   [Saavn+] ❌ No raw results from Saavn.")
        return []

    print(f"   [Saavn+] 📦 Raw results from Saavn ({len(raw_results)}):")
    for r in raw_results:
        print(f"      - '{r['title']}' — '{r['artist']}'")

    version_keywords = ['remix', 'mix', 'acoustic', 'cover', 'instrumental', 'slowed', 'sped', 'lofi', 'nightcore']
    query_wants_version = any(kw in query.lower() for kw in version_keywords)

    scored = []
    title_artist_counts = {}
    for t in raw_results:
        tl = t["title"].lower()
        n = len([a for a in t["artist"].split(",") if a.strip()])
        title_artist_counts.setdefault(tl, []).append(n)
    title_median_count = {tl: median(counts) for tl, counts in title_artist_counts.items()}

    for track in raw_results:
        track_title = track["title"].lower()
        track_artist_str = track["artist"].lower()

        score = 0

        if _has_dup_artist_name(track_artist_str):
            score -= 300

        track_artist_count = len([a for a in track["artist"].split(",") if a.strip()])
        med = title_median_count.get(track_title, 1)
        if track_artist_count == 1 and med >= 3:
            score -= 60

        track_has_version = any(kw in track_title for kw in version_keywords)
        if track_has_version and not query_wants_version:
            score -= 50
        elif not track_has_version and query_wants_version:
            score -= 50

        if track_title == query_title:
            score += 100
        elif query_title and query_title in track_title:
            extra_ratio = len(track_title) / max(len(query_title), 1)
            score += max(20, int(50 / extra_ratio))
        else:
            ratio = difflib.SequenceMatcher(None, query_title, track_title).ratio()
            score += int(ratio * 40)

        if query_artists:
            any_artist_match = False
            for qa in query_artists:
                if _artist_words_match(qa, track_artist_str):
                    any_artist_match = True
                    break

            if not any_artist_match:
                score -= 150

            matches = sum(1 for qa in query_artists if _artist_words_match(qa, track_artist_str))
            score += matches * 30

            if _artist_words_match(query_artist, track_artist_str):
                score += 20
                primary_artist = re.split(r'[,&]', track_artist_str)[0].strip()
                if _artist_words_match(query_artist, primary_artist):
                    score += 50

        if feat_artists:
            for fa in feat_artists:
                fa_words = set(re.sub(r"[^a-z0-9 ]", "", fa).split())
                t_words_clean = set(re.sub(r"[^a-z0-9 ]", "", track_artist_str).split())
                if fa_words and fa_words.issubset(t_words_clean):
                    score += 50

        cover_kws = ["cover", "tribute", "karaoke", "we rabbitz", "romy wave",
                     "robert mendoza", "lemongrass", "vibe2vibe"]
        if any(kw in track_artist_str for kw in cover_kws) and "cover" not in query.lower():
            score -= 180

        if is_junk(track) and not query_wants_version:
            score -= 180

        score -= rank_result(track) * 2

        scored.append({"track": track, "score": score})

    scored.sort(key=lambda x: x["score"], reverse=True)

    print(f"\n   [Saavn+] 📊 Ranked results after full evaluation:")
    for i, r in enumerate(scored[:6]):
        marker = "🥇" if i == 0 else f"#{i+1}"
        print(f"   {marker}  Score: {r['score']}")
        print(f"        '{r['track']['title']}' — '{r['track']['artist']}'")

    # For multi-artist queries, be more lenient — the correct song may not have all artists
    # listed in the Saavn result, so partial matches will have lower scores
    if len(query_artists) > 1:
        threshold = -120 if query_wants_version else -80
    else:
        threshold = -100 if query_wants_version else -50
    final_results = [r["track"] for r in scored if r["score"] > threshold]

    if final_results:
        best = final_results[0]
        print(f"\n   [Saavn+] ✅ WINNER: '{best['title']}' — '{best['artist']}'")
    else:
        print(f"\n   [Saavn+] ❌ No results cleared threshold. Checking raw fallbacks for title match…")

        _STOP = {"of", "in", "a", "an", "the", "to", "and", "or", "for",
                 "by", "on", "at", "is", "it", "its"}
        q_words = {
            w for w in re.sub(r"[^a-z0-9 ]", "", query_title.lower()).split()
            if w not in _STOP and len(w) > 1
        }

        def _title_match(track):
            t_title = track["title"].lower()
            # Require the query title to actually be a contiguous substring of the track title
            # (ignoring special chars) instead of just a jumble of matching words.
            clean_q = re.sub(r'[^a-z0-9]', '', query_title.lower())
            clean_t = re.sub(r'[^a-z0-9]', '', t_title)
            
            # If they share the exact same contiguous alphanumeric string
            if clean_q and clean_q in clean_t: return True
            if clean_t and clean_t in clean_q: return True
            
            # Or fallback to strict word subset if contiguous fails
            if not q_words: return True
            t_words = set(re.sub(r"[^a-z0-9 ]", "", t_title).split())
            return q_words.issubset(t_words)

        valid_fallbacks = [
            t for t in raw_results
            if _title_match(t) and not is_junk(t)
        ]
        junk_fallbacks = [
            t for t in raw_results
            if _title_match(t) and is_junk(t)
        ]

        if valid_fallbacks:
            # Sort fallbacks by how many query artists match — best artist match first
            def _fallback_artist_score(t):
                t_artist_str = t["artist"].lower()
                return sum(1 for qa in query_artists if _artist_words_match(qa, t_artist_str))

            valid_fallbacks.sort(key=_fallback_artist_score, reverse=True)
            final_results = valid_fallbacks + junk_fallbacks
            print(f"   [Saavn+] ↩️  Using {len(final_results)} title-matched fallback(s) (sorted by artist match)")
        elif junk_fallbacks:
            final_results = junk_fallbacks
            print(f"   [Saavn+] ↩️  Only junk matches found ({len(junk_fallbacks)}), using as last resort")
        else:
            final_results = []
            print(f"   [Saavn+] 🚫 No Saavn result matches '{query_title}' — yielding to YouTube")
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
