import requests
from requests.exceptions import RequestException
import datetime
import os
from dotenv import load_dotenv
load_dotenv()

from cache_manager import smart_cache
import random
import re
import lastfm_engine

def fix_artwork_url(url):
    if not url: return ''
    # Replace 100x100bb with 600x600bb safely
    # It handles ".../100x100bb.jpg" and ".../100x100bb.jpeg" etc
    # Use simple string replace only if it's clean, otherwise fallback
    # Regex is safer: replace (digits)x(digits)bb with 600x600bb
    return re.sub(r'\d+x\d+bb', '600x600bb', url)


@smart_cache(ttl=3600, validator=lambda x: x and len(x) > 0)
def search_metadata(query):
    """
    Searches iTunes (Apple Music) for metadata.
    NO KEY REQUIRED.
    """
    # print(f"   [Meta] Searching iTunes for: '{query}'")
    try:
        # iTunes Public API
        url = "https://itunes.apple.com/search"
        params = {
            "term": query,
            "media": "music",
            "entity": "song",
            "limit": 10
        }
        
        resp = requests.get(url, params=params, timeout=5)
        data = resp.json()
        
        if not data.get('results'):
            return []
            
        clean_results = []
        seen_titles = set() # Track what we've seen
        for track in data['results']:
            # iTunes gives 100x100 by default. We hack it to get 600x600 (HQ).
            unique_key = f"{track['trackName']}-{track['artistName']}"
            if unique_key in seen_titles:
                continue
            seen_titles.add(unique_key)

            hq_image = fix_artwork_url(track.get('artworkUrl100', ''))
            
            # Create a clean search term for our Audio Engines
            # e.g. "The Weeknd Starboy"
            search_term = f"{track['trackName']} {track['artistName']}"
            
            clean_results.append({
                "title": track['trackName'],
                "artist": track['artistName'],
                "album": track['collectionName'],
                "image": hq_image,
                "search_term": search_term, 
                "source": "apple_meta", # Flag to tell Hub this is metadata
                "album_id": track.get('collectionId', '')  # Add album_id for navigation
            })
            
        return clean_results

    except RequestException as e:
        print(f"   [Meta] Connection Error: {e}")
        raise e  # Propagate connection errors (timeouts, DNS, etc)
    except Exception as e:
        print(f"   [Meta] Error: {e}")
        return []

def _search_itunes_by_entity(query, entity, limit=10, offset=0, country="US"):
    """Helper function to search iTunes by specific entity type"""
    try:
        url = "https://itunes.apple.com/search"
        params = {
            "term": query,
            "media": "music",
            "entity": entity,
            "limit": limit,
            "offset": offset,
            "country": country
        }
        
        resp = requests.get(url, params=params, timeout=5)
        data = resp.json()
        
        return data.get('results', [])
    except RequestException as e:
        print(f"   [Meta] Connection Error searching {entity}: {e}")
        raise e
    except Exception as e:
        print(f"   [Meta] Error searching {entity}: {e}")
        return []

@smart_cache(ttl=86400, validator=lambda x: x and (x.get('songs') or x.get('albums') or x.get('artists')))
def search_metadata_categorized(query, offset=0):
    """
    Searches iTunes for Songs, Albums, and Artists in separate categories.
    Returns a dict with categorized results.
    
    Args:
        query: Search term
        offset: Number of results to skip for pagination
    """
    print(f"   [Meta] Searching iTunes (categorized) for: '{query}' (offset: {offset})", flush=True)
    
    # Fetch all categories
    # Reverting to sequential due to Gunicorn worker issues
    
    # 1. Fetch Songs (Interleaved Original + Merged)
    from itertools import zip_longest
    
    # Primary Search
    songs_q1 = _search_itunes_by_entity(query, "song", limit=50, offset=offset)
    songs_q2 = []
    
    # Secondary Search (Merged) - Only if spaces exist
    if " " in query:
        merged_query = query.replace(" ", "")
        print(f"   [Meta] Also searching merged query: '{merged_query}'", flush=True)
        songs_q2 = _search_itunes_by_entity(merged_query, "song", limit=50, offset=offset)
    
    # Interleave results [A1, B1, A2, B2...]
    songs_raw = []
    for r1, r2 in zip_longest(songs_q1, songs_q2):
        if r1: songs_raw.append(r1)
        if r2: songs_raw.append(r2)
        
    print(f"   [Meta] Found {len(songs_raw)} raw songs (combined)", flush=True)
        
    albums_raw = _search_itunes_by_entity(query, "album", limit=20, offset=offset)
    print(f"   [Meta] Found {len(albums_raw)} raw albums", flush=True)

    artists_raw = _search_itunes_by_entity(query, "musicArtist", limit=10, offset=offset)
    print(f"   [Meta] Found {len(artists_raw)} raw artists", flush=True)
    
    print(f"   [Meta] Found {len(artists_raw)} raw artists", flush=True)

    # Process Songs
    songs = []
    seen_ids = set() # Track by ID to deduplicate interleaved results
    seen_titles = set() # Fallback for different IDs but same song
    
    for track in songs_raw:
        # Filter out compilation/playlist albums - but keep movie soundtracks and singles
        album_name = track.get('collectionName', '').lower()

        # Skip if iTunes explicitly marks as Compilation
        if track.get('collectionType') == 'Compilation':
            continue
        
        # These keywords indicate DJ mixes / radio playlists — NOT movie soundtracks or studio albums
        compilation_patterns = [
            'non-stop', 'party song', 'party with', 'best of',
            'hit song', 'super hit', 'dj mix', 'mashup',
            'romantic hit', 'evergreen', 'jamming with',
            'vibe with', 'top ', ' bollywood', 'party hit',
            'party mix', 'party essential', 'love song',
            'blockbuster', 'valentine',
            'now that', 'hot 100', 'chart hit', 'playlist',
            'top hits', 'jukebox', 'mixtape', 'various', 'compilation',
            '#1 hit', 'number one hits',
            'throwback', 'rewind', 'fm hits', 'radio hits',
            'pop hits', 'dance hits', 'summer hits', 'winter hits',
            'wedding song', 'super hits', 'mega hits',
            'workout song', 'driving song', 'sad song',
            'morning song', 'night songs', 'chill song',
        ]
        
        # Check if it's a compilation
        is_compilation = any(pattern in album_name for pattern in compilation_patterns)
        
        # Skip compilations
        if is_compilation:
            continue
        
        # Deduplicate
        track_id = track.get('trackId')
        unique_key = f"{track.get('trackName', '')}-{track.get('artistName', '')}"

        if track_id in seen_ids or unique_key in seen_titles:
            continue
            
        if track_id: seen_ids.add(track_id)
        seen_titles.add(unique_key)
        
        hq_image = fix_artwork_url(track.get('artworkUrl100', ''))
        search_term = f"{track.get('trackName')} {track.get('artistName')}"
        
        songs.append({
            "title": track.get('trackName'),
            "artist": track.get('artistName'),
            "album": track.get('collectionName'),
            "image": hq_image,
            "search_term": search_term,
            "source": "apple_meta",
            "album_id": track.get('collectionId', ''),
            "preview_url": track.get('previewUrl') # Added preview_url for audio previews
        })

    # Process Albums...
    
    # Process Albums
    albums = []
    seen_albums = set()
    for album in albums_raw:
        unique_key = f"{album.get('collectionName', '')}-{album.get('artistName', '')}"
        if unique_key in seen_albums or not album.get('collectionName'):
            continue
        seen_albums.add(unique_key)
        
        hq_image = fix_artwork_url(album.get('artworkUrl100', ''))
        
        albums.append({
            "title": album['collectionName'],
            "artist": album.get('artistName', 'Unknown Artist'),
            "image": hq_image,
            "album_id": album.get('collectionId'),
            "track_count": album.get('trackCount', 0),
            "source": "apple_meta",
            "type": "album"
        })
    
    # Process Artists
    artists = []
    seen_artists = set()
    for artist in artists_raw:
        artist_name = artist.get('artistName', '')
        if artist_name in seen_artists or not artist_name:
            continue
        seen_artists.add(artist_name)
        
        # Get artist image — try Last.fm first (real photos), then iTunes album art fallback
        artist_image = lastfm_engine.get_artist_image(artist_name)

        if not artist_image:
            # Fallback: use iTunes artworkUrl100 or search their albums
            if artist.get('artworkUrl100'):
                artist_image = fix_artwork_url(artist.get('artworkUrl100', ''))
            else:
                try:
                    artist_albums = _search_itunes_by_entity(artist_name, "album", limit=1)
                    if artist_albums and artist_albums[0].get('artworkUrl100'):
                        artist_image = fix_artwork_url(artist_albums[0].get('artworkUrl100', ''))
                except:
                    pass
        
        artists.append({
            "name": artist_name,
            "artist_id": artist.get('artistId'),
            "image": artist_image,
            "genre": artist.get('primaryGenreName', ''),
            "source": "apple_meta",
            "type": "artist"
        })
    
    return {
        "songs": songs,
        "albums": albums,
        "artists": artists,
        "playlists": []  # iTunes API doesn't provide playlists
    }

@smart_cache(ttl=86400, validator=lambda x: x and x.get('songs'))
def get_album_tracks(album_id):
    """
    Fetch all tracks from a specific album using iTunes lookup API.
    Returns list of songs with metadata.
    """
    try:
        url = "https://itunes.apple.com/lookup"
        params = {
            "id": album_id,
            "entity": "song"
        }
        
        resp = requests.get(url, params=params, timeout=5)
        data = resp.json()
        
        results = data.get('results', [])
        if not results:
            return None
        
        # First result is the album info
        album_info = results[0]
        tracks = results[1:]  # Rest are tracks
        
        songs = []
        for track in tracks:
            if track.get('wrapperType') == 'track' and track.get('trackName'):
                hq_image = fix_artwork_url(track.get('artworkUrl100', ''))
                search_term = f"{track['trackName']} {track.get('artistName', '')}"
                
                songs.append({
                    "title": track['trackName'],
                    "artist": track.get('artistName', 'Unknown Artist'),
                    "album": track.get('collectionName', ''),
                    "image": hq_image,
                    "search_term": search_term,
                    "track_number": track.get('trackNumber', 0),
                    "duration_ms": track.get('trackTimeMillis', 0),
                    "source": "apple_meta",
                    "type": "song"
                })
        
        # Sort by track number
        songs.sort(key=lambda x: x.get('track_number', 0))
        
        return {
            "album_name": album_info.get('collectionName', ''),
            "artist_name": album_info.get('artistName', ''),
            "artwork": album_info.get('artworkUrl100', '').replace('100x100bb', '600x600bb'),
            "release_date": album_info.get('releaseDate', ''),
            "genre": album_info.get('primaryGenreName', ''),
            "track_count": album_info.get('trackCount', 0),
            "songs": songs
        }
    except Exception as e:
        print(f"   [Meta] Error fetching album tracks: {e}")
        return None

@smart_cache(ttl=86400, validator=lambda x: x and (x.get('songs') or x.get('albums')))
def get_artist_songs(artist_name):
    """
    Fetch top songs and ALL albums from a specific artist.
    Returns list of popular songs and sorted albums.
    """
    try:
        # Search for artist's top songs
        songs_raw = _search_itunes_by_entity(artist_name, "song", limit=20)
        
        # Get artist albums (increased limit and sorting)
        albums_raw = _search_itunes_by_entity(artist_name, "album", limit=60)
        
        songs = []
        seen_songs = set()
        for track in songs_raw:
            # Only include songs by this exact artist
            if track.get('artistName', '').lower() != artist_name.lower():
                continue
                
            unique_key = f"{track.get('trackName', '')}-{track.get('artistName', '')}"
            if unique_key in seen_songs or not track.get('trackName'):
                continue
            seen_songs.add(unique_key)
            
            hq_image = fix_artwork_url(track.get('artworkUrl100', ''))
            search_term = f"{track['trackName']} {track['artistName']}"
            
            songs.append({
                "title": track['trackName'],
                "artist": track.get('artistName', 'Unknown Artist'),
                "album": track.get('collectionName', ''),
                "image": hq_image,
                "search_term": search_term,
                "source": "apple_meta",
                "type": "song",
                "preview_url": track.get('previewUrl')
            })
        
        # Process Albums
        albums = []
        seen_albums = set()
        
        # Pre-process to filter and deduplicate
        valid_albums = []
        for album in albums_raw:
            # Strict artist match to avoid "Various Artists" compilations
            if album.get('artistName', '').lower() != artist_name.lower():
                continue
                
            unique_key = f"{album.get('collectionName', '')}"
            if unique_key in seen_albums or not album.get('collectionName'):
                continue
            seen_albums.add(unique_key)
            valid_albums.append(album)
            
        # Sort by Release Date (Newest First)
        valid_albums.sort(key=lambda x: x.get('releaseDate', ''), reverse=True)
            
        for album in valid_albums:
            hq_image = fix_artwork_url(album.get('artworkUrl100', ''))
            
            albums.append({
                "title": album['collectionName'],
                "artist": album.get('artistName', 'Unknown Artist'),
                "album": album['collectionName'],
                "image": hq_image,
                "album_id": album.get('collectionId'),
                "track_count": album.get('trackCount', 0),
                "release_date": album.get('releaseDate', '').split('T')[0], # YYYY-MM-DD
                "source": "apple_meta",
                "type": "album"
            })
        
        # Get artist image — try Deezer first, then iTunes fallback
        artist_image = lastfm_engine.get_artist_image(artist_name)
        
        if not artist_image:
            if valid_albums and valid_albums[0].get('artworkUrl100'):
                artist_image = valid_albums[0].get('artworkUrl100', '').replace('100x100bb', '600x600bb')
            elif songs and songs[0].get('image'):
                 artist_image = songs[0].get('image')
        
        return {
            "artist_name": artist_name,
            "artist_image": artist_image,
            "genre": valid_albums[0].get('primaryGenreName', '') if valid_albums else '',
            "songs": songs,
            "albums": albums  # Return ALL sorted albums
        }
    except Exception as e:
        print(f"   [Meta] Error fetching artist songs: {e}")
        return None

import difflib

@smart_cache(ttl=7200, validator=lambda x: x is not None)
def get_video_preview(query):
    """
    Fetches a 30-second video preview from iTunes.
    Uses fuzzy matching to ensure the video actually matches the song/artist.
    """
    try:
        url = "https://itunes.apple.com/search"
        params = {
            "term": query,
            "media": "musicVideo",
            "entity": "musicVideo",
            "limit": 5  # increased limit to find better matches
        }
        resp = requests.get(url, params=params, timeout=5)
        if resp.status_code != 200:
            print(f"   [Meta] iTunes API returned status {resp.status_code}")
            return None
        try:
            data = resp.json()
        except Exception as e:
            print(f"   [Meta] Failed to parse iTunes response: {e}")
            return None
        
        if not data.get('results'):
            return None
            
        # Fuzzy Match Logic
        query = query.lower()
        best_ratio = 0.0
        best_video = None
        
        for vid in data['results']:
            # Construct a comparison string from the video result
            vid_title = vid.get('trackName', '')
            vid_artist = vid.get('artistName', '')
            vid_string = f"{vid_title} {vid_artist}".lower()
            
            # Base fuzzy score
            ratio = difflib.SequenceMatcher(None, query, vid_string).ratio()
            
            # 1. STRICT ARTIST CHECK
            # If the video artist is completely missing from the query, reject it.
            # Split artist into words, ignore common joiners like &, feat, etc.
            artist_words = [w for w in vid_artist.lower().replace('&', '').replace(',', '').split() if w not in ['feat', 'feat.', 'featuring', 'the']]
            if artist_words:
                # Check if ANY significant artist word is in the query
                # Exception: If multiple words, requiring at least one is usually safe.
                if not any(w in query for w in artist_words):
                    ratio -= 0.5  # Heavy penalty
            
            # 2. STRICT TITLE CHECK
            # The video title must be somewhat present in the query
            # "Circles" should not match "Wolves"
            clean_vid_title = vid_title.lower().split('(')[0].strip() # Remove (Official Video) etc
            if clean_vid_title not in query:
                 # Try word based: at least the first word of title must be in query?
                 first_word = clean_vid_title.split()[0] if clean_vid_title else ""
                 if first_word and first_word not in query:
                      ratio -= 0.3

            # Boost score if artist matches perfectly
            if vid_artist.lower() in query:
                ratio += 0.1

            if ratio > best_ratio:
                best_ratio = ratio
                best_video = vid
        
        if best_ratio > 0.6 and best_video:
             return best_video.get('previewUrl')
            
        # --- FALLBACK 1: Try searching with "Official Video" ---
        if "official video" not in query:
            fallback_query = f"{query} official video"
            params['term'] = fallback_query
            resp = requests.get(url, params=params, timeout=5)
            if resp.status_code != 200:
                print(f"   [Meta] iTunes API returned status {resp.status_code}")
            else:
                try:
                    data = resp.json()
                    if data.get('results'):
                        vid = data['results'][0]
                        return vid.get('previewUrl')
                except Exception as e:
                    print(f"   [Meta] Failed to parse iTunes response: {e}")

        # --- FALLBACK 2: Generic Loop ---
        # If no specific video found, return a high-quality abstract loop
        # This ensures the UI always has a dynamic background
        return "https://cdn.pixabay.com/video/2020/04/18/36427-410774786_large.mp4" # Abstract particles loop

    except Exception as e:
        print(f"   [Meta] Error fetching video preview: {e}")
        return "https://cdn.pixabay.com/video/2020/04/18/36427-410774786_large.mp4" # Fallback on error too

import lastfm_engine

@smart_cache(ttl=1800, validator=lambda x: x and (x.get('songs') or x.get('albums')))
def get_category_songs(category_id):
    """
    Get curated songs for specific categories.
    Uses Last.fm for real charts when available, falls back to iTunes.
    """
    try:
        # Use Last.fm for global top charts
        if category_id == 'top100':
            print(f"   [Meta] Fetching Top 100 from Last.fm...")
            tracks = lastfm_engine.get_global_top_tracks(limit=50)
            if tracks:
                # Enrich Last.fm tracks with iTunes artwork + album name
                # (Last.fm images are often empty/broken)
                enriched = []
                for t in tracks:
                    if not t.get('image'):
                        try:
                            itunes_results = _search_itunes_by_entity(
                                f"{t['title']} {t['artist']}", "song", limit=1, country="US"
                            )
                            if itunes_results:
                                hit = itunes_results[0]
                                t['image'] = fix_artwork_url(hit.get('artworkUrl100', ''))
                                t['album'] = hit.get('collectionName', '')
                        except Exception:
                            pass
                    enriched.append(t)
                return {"songs": enriched, "albums": []}
        
        # Use iTunes for Hindi categories (Last.fm shows K-pop for India)
        # Define curated queries for each category
        category_queries = {
            'top100': [
                'Bad Bunny', 'Taylor Swift', 'The Weeknd', 'Drake', 
                'Olivia Rodrigo', 'SZA', 'Morgan Wallen', 'Doja Cat',
                'Ariana Grande', 'Ed Sheeran', 'Post Malone', 'Billie Eilish'
            ],
            'latest': [
                'new releases 2024', 'latest hits', 'new songs'
            ],
            'trending': [
                'viral hits', 'trending now', 'popular songs 2024'
            ],
            'hits': [
                # Classic legendary artists — fetch songs NOT greatest-hits compilations
                'Michael Jackson', 'The Beatles', 'Queen', 'Eagles',
                'Led Zeppelin', 'David Bowie', 'Elton John', 'ABBA',
                'Elvis Presley', 'Frank Sinatra', 'Fleetwood Mac', 'The Rolling Stones'
            ],
            'charts_hindi': [
                'Arijit Singh', 'Neha Kakkar', 'Atif Aslam', 
                'Shreya Ghoshal', 'Badshah', 'Yo Yo Honey Singh',
                'Jubin Nautiyal', 'B Praak', 'Darshan Raval',
                'Sachet Tandon', 'Vishal Mishra', 'Sidhu Moose Wala'
            ],
            'popular_albums': [
                'Post Malone', 'Taylor Swift', 'The Weeknd', 
                'SZA', 'Olivia Rodrigo', 'Drake',
                'Arijit Singh', 'Dua Lipa', 'Travis Scott',
                'Billie Eilish', 'Bad Bunny', 'Kendrick Lamar'
            ],
            'recent_hindi_releases': [
                # Most popular current Hindi artists (ordered by popularity/recent activity)
                'Arijit Singh', 'B Praak', 'Jubin Nautiyal',
                'Vishal Mishra', 'Darshan Raval', 'Sachet Tandon',
                'Badshah', 'Neha Kakkar', 'Shreya Ghoshal',
                'Armaan Malik', 'Atif Aslam', 'Tulsi Kumar'
            ]
        }
        
        queries = category_queries.get(category_id, [])
        if not queries:
            return None
        
        all_songs = []
        all_albums = []
        seen_songs = set()
        seen_albums = set()
        
        # Set target song count based on category
        target_count = 100 if category_id == 'top100' else 50
        
        # For artist-based categories, search for specific popular artists
        if category_id in ('top100', 'charts_hindi', 'popular_albums', 'recent_hindi_releases', 'hits'):
            for artist in queries[:12]:  # Use all 12 artists for more variety
                entity = "album" if category_id == 'popular_albums' else "song"
                
                # Fetch more songs for 'recent' to find newer tracks that might not be top hits
                if category_id == 'popular_albums':
                    limit = 5
                elif category_id == 'recent_hindi_releases':
                    limit = 25
                elif category_id == 'charts_hindi':
                    limit = 5  # Fetch fewer per artist but from ALL artists to mix
                else:
                    limit = 10
                
                # Use Indian store for Hindi releases to avoid global confusion
                country = "IN" if category_id in ('recent_hindi_releases', 'charts_hindi') else "US"
                results_raw = _search_itunes_by_entity(artist, entity, limit=limit, country=country)
                
                for track in results_raw:
                    if entity == "album":
                        title = track.get('collectionName', '')
                        unique_key = f"{title}-{track.get('artistName', '')}"
                        if unique_key in seen_albums or not title:
                            continue
                        seen_albums.add(unique_key)
                        
                        hq_image = fix_artwork_url(track.get('artworkUrl100', ''))
                        
                        all_albums.append({
                            "title": title,
                            "artist": track.get('artistName', 'Unknown Artist'),
                            "album": title,
                            "image": hq_image,
                            "album_id": track.get('collectionId', ''),
                            "search_term": f"{title} {track.get('artistName', '')}",
                            "source": "apple_meta",
                            "type": "album"
                        })
                    else:
                        # Filter out compilation/playlist albums
                        album_name = track.get('collectionName', '').lower()

                        # Skip if iTunes explicitly marks as Compilation
                        if track.get('collectionType') == 'Compilation':
                            continue

                        # These keywords indicate DJ mixes / radio playlists — NOT movie soundtracks or studio albums
                        compilation_patterns = [
                            'non-stop', 'party song', 'party with', 'best of',
                            'hit song', 'super hit', 'dj mix', 'mashup',
                            'romantic hit', 'evergreen', 'jamming with',
                            'vibe with', 'top ', ' bollywood', 'party hit',
                            'party mix', 'party essential', 'love song',
                            'blockbuster', 'valentine',
                            'now that', 'hot 100', 'chart hit', 'playlist',
                            'top hits', 'jukebox', 'mixtape', 'various', 'compilation',
                            '#1 hit', 'number one hits',
                            'throwback', 'rewind', 'fm hits', 'radio hits',
                            'pop hits', 'dance hits', 'summer hits', 'winter hits',
                            'wedding song', 'super hits', 'mega hits',
                            'workout song', 'driving song', 'sad song',
                            'morning song', 'night songs', 'chill song',
                        ]
                        is_compilation = any(p in album_name for p in compilation_patterns)
                        
                        # Skip compilations
                        if is_compilation:
                            continue
                        
                        unique_key = f"{track.get('trackName', '')}-{track.get('artistName', '')}"
                        if unique_key in seen_songs or not track.get('trackName'):
                            continue
                        seen_songs.add(unique_key)
                        
                        hq_image = fix_artwork_url(track.get('artworkUrl100', ''))
                        search_term = f"{track['trackName']} {track['artistName']}"
                        
                        release_date = track.get('releaseDate', '')
                        
                        all_songs.append({
                            "title": track['trackName'],
                            "artist": track.get('artistName', 'Unknown Artist'),
                            "album": track.get('collectionName', ''),
                            "image": hq_image,
                            "search_term": search_term,
                            "source": "apple_meta",
                            "type": "song",
                            "release_date": release_date
                        })
                    
                    # Stop early for regular categories, but collect MORE for recent releases to sort later
                    if len(all_songs) >= target_count and category_id not in ('popular_albums', 'recent_hindi_releases', 'charts_hindi'):
                        break
                    if len(all_albums) >= target_count and category_id == 'popular_albums':
                        break
                        
                # Outer loop break
                if len(all_songs) >= target_count and category_id not in ('popular_albums', 'recent_hindi_releases', 'charts_hindi'):
                    break
                if len(all_albums) >= target_count and category_id == 'popular_albums':
                    break
            
            # Post-processing for Specific Categories
            if category_id == 'recent_hindi_releases':
                # Supplementary: search specific recent hit song titles directly
                # This catches collaborative/multi-credit songs missed by artist-only searches
                # (e.g. "Gehra Hua" artist="Shashwat Sachdev, Arijit Singh, ..." won't appear under "Arijit Singh")
                recent_hit_titles = [
                    'Gehra Hua Dhurandhar', 'Tere Vaaste', 'O Bedardeya',
                    'Kesariya', 'Raataan Lambiyan', 'Teri Baaton Mein',
                    'Pehle Bhi Main', 'Satrangee', 'Tu Mileya',
                ]
                for song_title in recent_hit_titles:
                    try:
                        title_results = _search_itunes_by_entity(song_title, "song", limit=1, country="IN")
                        for track in title_results:
                            unique_key = f"{track.get('trackName', '')}-{track.get('artistName', '')}"
                            if unique_key in seen_songs or not track.get('trackName'):
                                continue
                            # Apply same compilation filter
                            album_name = track.get('collectionName', '').lower()
                            if track.get('collectionType') == 'Compilation':
                                continue
                            compilation_patterns_check = [
                                'non-stop', 'party song', 'party with', 'best of',
                                'hit song', 'super hit', 'dj mix', 'mashup',
                                'romantic hit', 'evergreen', 'jamming with',
                                'vibe with', 'top ', ' bollywood', 'party hit',
                                'party mix', 'party essential', 'love song',
                                'blockbuster', 'valentine', 'now that', 'hot 100',
                                'chart hit', 'playlist', 'greatest hit', 'all time',
                                'top hits', 'jukebox', 'mixtape', 'various', 'compilation',
                                'the very best', '#1 hit', 'number one', 'throwback',
                                'rewind', 'fm hits', 'radio hits', 'pop hits', 'dance hits',
                                'summer hits', 'winter hits', 'wedding song', 'super hits',
                                'mega hits', 'workout song', 'driving song', 'sad song',
                                'morning song', 'night songs', 'chill song',
                            ]
                            if any(p in album_name for p in compilation_patterns_check):
                                continue
                            seen_songs.add(unique_key)
                            hq_image = fix_artwork_url(track.get('artworkUrl100', ''))
                            search_term = f"{track['trackName']} {track['artistName']}"
                            all_songs.append({
                                "title": track['trackName'],
                                "artist": track.get('artistName', 'Unknown Artist'),
                                "album": track.get('collectionName', ''),
                                "image": hq_image,
                                "search_term": search_term,
                                "source": "apple_meta",
                                "type": "song",
                                "release_date": track.get('releaseDate', '')
                            })
                    except Exception:
                        pass

                # Sort by release date (newest first)
                all_songs.sort(key=lambda x: x.get('release_date', ''), reverse=True)
                # Take top 50
                all_songs = all_songs[:50]
            
            if category_id == 'charts_hindi':
                # Shuffle to mix artists (don't show grouped by artist)
                random.shuffle(all_songs)
                # Take top 50
                all_songs = all_songs[:50]
        else:
            # For other categories, use search queries
            for query in queries[:3]:  # Use first 3 queries for more variety
                country = "IN" if category_id in ('charts_hindi', 'recent_hindi_releases') else "US"
                songs_raw = _search_itunes_by_entity(query, "song", limit=20, country=country)
                
                for track in songs_raw:
                    unique_key = f"{track.get('trackName', '')}-{track.get('artistName', '')}"
                    if unique_key in seen_songs or not track.get('trackName'):
                        continue
                    seen_songs.add(unique_key)
                    
                    hq_image = fix_artwork_url(track.get('artworkUrl100', ''))
                    search_term = f"{track['trackName']} {track['artistName']}"
                    
                    all_songs.append({
                        "title": track['trackName'],
                        "artist": track.get('artistName', 'Unknown Artist'),
                        "album": track.get('collectionName', ''),
                        "image": hq_image,
                        "search_term": search_term,
                        "source": "apple_meta",
                        "type": "song",
                        "preview_url": track.get('previewUrl', '')
                    })
                    
                    if len(all_songs) >= target_count:
                        break
                if len(all_songs) >= target_count:
                    break
        
        return {"songs": all_songs, "albums": all_albums}
        
    except RequestException as e:
        print(f"   [Meta] Connection Error fetching category songs: {e}")
        # For category pages, we might want to return None so the UI shows an error
        raise e
    except Exception as e:
        print(f"   [Meta] Error fetching category songs: {e}")
        return None

@smart_cache(ttl=86400, validator=lambda x: x and len(x) > 0)
def get_top_global_artists():
    """
    Returns a curated list of top global streaming artists.
    Lazily fetches high-quality images via lastfm_engine.
    """
    print(f"   [Meta] Fetching Top Global Artists list...", flush=True)
    
    # 12 Artists for a massive grid
    top_artists_list = [
        "The Weeknd",
        "Taylor Swift",
        "Arijit Singh",
        "Drake",
        "Bad Bunny",
        "Ed Sheeran",
        "Justin Bieber",
        "Rihanna",
        "Dua Lipa",
        "Billie Eilish",
        "Post Malone",
        "Bruno Mars"
    ]
    
    results = []
    for count, artist_name in enumerate(top_artists_list):
        # Fetch image using existing Last.fm integration
        artist_image = lastfm_engine.get_artist_image(artist_name)
        
        # If no image found, fallback empty string
        if not artist_image:
            artist_image = ""
            
        results.append({
            "id": f"global-artist-{count}",
            "name": artist_name,
            "artist": artist_name, # Alias for frontend compatibility 
            "image": artist_image,
            "type": "artist"
        })
        
    return {"artists": results}