import os
import requests
from cache_manager import smart_cache
import re

LASTFM_API_KEY = os.getenv('LASTFM_API_KEY', '')
LASTFM_BASE_URL = "http://ws.audioscrobbler.com/2.0/"

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
    """
    if not LASTFM_API_KEY:
        print("   [LastFM] No API key configured")
        return []
    
    try:
        params = {
            'method': 'chart.gettoptracks',
            'api_key': LASTFM_API_KEY,
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
                'image': fix_artwork_url(_get_image_url(track.get('image', []))),
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
    """
    if not LASTFM_API_KEY:
        print("   [LastFM] No API key configured")
        return []
    
    try:
        params = {
            'method': 'geo.gettoptracks',
            'api_key': LASTFM_API_KEY,
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
                'image': fix_artwork_url(_get_image_url(track.get('image', []))),
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
    Get global top artists from Last.fm.
    """
    if not LASTFM_API_KEY:
        print("   [LastFM] No API key configured")
        return []
    
    try:
        params = {
            'method': 'chart.gettopartists',
            'api_key': LASTFM_API_KEY,
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
            
            results.append({
                'name': artist_name,
                'artist_id': artist.get('mbid', ''),
                'image': fix_artwork_url(_get_image_url(artist.get('image', []))),
                'playcount': artist.get('playcount', ''),
                'listeners': artist.get('listeners', ''),
                'source': 'lastfm'
            })
        
        return results
        
    except Exception as e:
        print(f"   [LastFM] Error fetching top artists: {e}")
        return []

DEEZER_API = "https://api.deezer.com"

@smart_cache(ttl=604800, validator=lambda x: bool(x))
def get_artist_image(artist_name):
    """
    Fetch a real artist photo from Deezer's public API (no key required).
    Returns picture_xl (500x500) URL or '' if not found.
    """
    if not artist_name:
        return ''
    try:
        resp = requests.get(
            f"{DEEZER_API}/search/artist",
            params={'q': artist_name, 'limit': 1},
            timeout=6
        )
        data = resp.json()
        results = data.get('data', [])
        if not results:
            return ''
        artist = results[0]
        # Prefer picture_xl (500x500), fall back to smaller sizes
        for key in ('picture_xl', 'picture_big', 'picture_medium', 'picture'):
            url = artist.get(key, '')
            if url and 'default_artist' not in url:
                return url
        return ''
    except Exception as e:
        print(f"   [Deezer] Error fetching artist image for '{artist_name}': {e}")
        return ''
