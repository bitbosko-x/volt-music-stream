import os
import requests
from urllib.parse import quote
from .cache import smart_cache
import re

LASTFM_BASE_URL = "http://ws.audioscrobbler.com/2.0/"

def _get_api_key():
    """Read lazily so load_dotenv() order doesn't matter."""
    return os.getenv('LASTFM_API_KEY', '')

def fix_artwork_url(url):
    if not url: return ''
    return re.sub(r'\d+x\d+', '300x300', url)

def _get_image_url(images, size='extralarge'):
    for img in images:
        if img.get('size') == size:
            return img.get('#text', '')
    for img in images:
        if img.get('#text'):
            return img.get('#text', '')
    return ''

@smart_cache(ttl=1800, validator=lambda x: x and len(x) > 0)
def get_global_top_tracks(limit=50):
    """
    Get global top tracks from Last.fm charts.
    Images are intentionally left blank — metadata_engine enriches them
    with iTunes artwork after the fact (Last.fm track images are all silhouettes).
    """
    api_key = _get_api_key()
    if not api_key:
        print("   [LastFM] No API key configured")
        return []
    
    try:
        params = {
            'method': 'chart.gettoptracks',
            'api_key': api_key,
            'format': 'json',
            'limit': limit
        }
        resp = requests.get(LASTFM_BASE_URL, params=params, timeout=10)
        data = resp.json()
        
        tracks = data.get('tracks', {}).get('track', [])
        results = []
        
        for track in tracks:
            artist_name = track.get('artist', {}).get('name', '')
            track_name = track.get('name', '')
            
            if not artist_name or not track_name:
                continue
            
            results.append({
                'title': track_name,
                'artist': artist_name,
                'album': '',
                'image': '',   # Left blank — enriched with iTunes art in metadata engine
                'search_term': f"{track_name} {artist_name}",
                'source': 'lastfm',
                'playcount': track.get('playcount', ''),
                'listeners': track.get('listeners', '')
            })
        
        return results
        
    except Exception as e:
        print(f"   [LastFM] Error fetching global top tracks: {e}")
        return []

@smart_cache(ttl=1800, validator=lambda x: x and len(x) > 0)
def get_country_top_tracks(country='india', limit=50):
    """
    Get top tracks for a specific country from Last.fm.
    Images left blank — enriched by the caller with iTunes artwork.
    """
    api_key = _get_api_key()
    if not api_key:
        print("   [LastFM] No API key configured")
        return []
    
    try:
        params = {
            'method': 'geo.gettoptracks',
            'api_key': api_key,
            'format': 'json',
            'country': country,
            'limit': limit
        }
        resp = requests.get(LASTFM_BASE_URL, params=params, timeout=10)
        data = resp.json()
        
        tracks = data.get('tracks', {}).get('track', [])
        results = []
        
        for track in tracks:
            artist_name = track.get('artist', {}).get('name', '')
            track_name = track.get('name', '')
            
            if not artist_name or not track_name:
                continue
            
            results.append({
                'title': track_name,
                'artist': artist_name,
                'album': '',
                'image': '',   # Left blank — enriched with iTunes art by the caller
                'search_term': f"{track_name} {artist_name}",
                'source': 'lastfm',
                'playcount': track.get('playcount', ''),
                'listeners': track.get('listeners', '')
            })
        
        return results
        
    except Exception as e:
        print(f"   [LastFM] Error fetching country top tracks: {e}")
        return []

@smart_cache(ttl=3600, validator=lambda x: x and len(x) > 0)
def get_top_artists(limit=20):
    """
    Get global top artists from Last.fm with real photos from Deezer/Wikipedia.
    """
    api_key = _get_api_key()
    if not api_key:
        print("   [LastFM] No API key configured")
        return []
    
    try:
        params = {
            'method': 'chart.gettopartists',
            'api_key': api_key,
            'format': 'json',
            'limit': limit
        }
        resp = requests.get(LASTFM_BASE_URL, params=params, timeout=10)
        data = resp.json()
        
        artists = data.get('artists', {}).get('artist', [])
        results = []
        
        for artist in artists:
            artist_name = artist.get('name', '')
            if not artist_name:
                continue
            
            # get_artist_image uses Deezer → Wikipedia fallback chain
            artist_img = get_artist_image(artist_name)
            
            results.append({
                'name': artist_name,
                'artist_id': artist.get('mbid', ''),
                'image': artist_img,
                'playcount': artist.get('playcount', ''),
                'listeners': artist.get('listeners', ''),
                'source': 'lastfm'
            })
        
        return results
        
    except Exception as e:
        print(f"   [LastFM] Error fetching top artists: {e}")
        return []

DEEZER_API = "https://api.deezer.com"

# Last.fm generic silhouette hash — filter this out
_LASTFM_GENERIC = "2a96cbd8b46e442fc41c2b86b821562f"
_LASTFM_SIZE_PREF = ["extralarge", "mega", "large", "medium", "small"]


def get_artist_image_lastfm(artist_name):
    """
    Last.fm deprecated real image hosting in 2019 — every URL they return
    is now the generic silhouette hash (2a96cbd8b46e442fc41c2b86b821562f).
    Kept as a stub so callers don't break; always returns '' to skip to Deezer.
    """
    return ''


def get_artist_image_wikipedia(artist_name):
    """
    Fetch artist image from Wikipedia using the MediaWiki REST API.
    No API key required. Returns '' if not found.
    """
    try:
        for search_name in [artist_name, f"{artist_name} (musician)", f"{artist_name} (singer)", f"{artist_name} (band)"]:
            url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(search_name)}"
            resp = requests.get(
                url,
                timeout=6,
                headers={'User-Agent': 'Volt-Music-App/1.0 (music streaming)'}
            )
            if resp.status_code != 200:
                continue
            data = resp.json()
            if data.get('type') == 'disambiguation':
                continue
            img = data.get('originalimage', {}).get('source', '') or \
                  data.get('thumbnail', {}).get('source', '')
            if img:
                print(f"   [Wikipedia] Artist image found for '{artist_name}': {img[:60]}...")
                return img
    except Exception as e:
        print(f"   [Wikipedia] Error fetching image for '{artist_name}': {e}")
    return ''


@smart_cache(ttl=604800, validator=lambda x: bool(x))
def get_artist_image(artist_name):
    """
    Fetch a real artist photo.
    Fallback chain: Deezer → Wikipedia → ''
    Cached for 7 days.
    """
    if not artist_name:
        return ''

    # 1. Deezer — best quality, covers most mainstream artists
    try:
        resp = requests.get(
            f"{DEEZER_API}/search/artist",
            params={'q': artist_name, 'limit': 1},
            timeout=6
        )
        data = resp.json()
        results = data.get('data', [])
        if results:
            artist = results[0]
            for key in ('picture_xl', 'picture_big', 'picture_medium', 'picture'):
                img_url = artist.get(key, '')
                if img_url and 'default_artist' not in img_url:
                    print(f"   [Deezer] Artist image found for '{artist_name}': {img_url[:60]}...")
                    return img_url
    except Exception as e:
        print(f"   [Deezer] Error fetching artist image for '{artist_name}': {e}")

    # 2. Wikipedia — covers niche/regional/older artists Deezer may miss
    img = get_artist_image_wikipedia(artist_name)
    if img:
        return img

    return ''
