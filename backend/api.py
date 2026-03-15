import os
import re
from dotenv import load_dotenv
load_dotenv()

from . import hub
from .engines import metadata as metadata_engine
from .engines import youtube as yt_engine
from .engines import lastfm as lastfm_engine
from flask import Flask, request, jsonify, send_file, Response, stream_with_context
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from urllib.parse import urlparse
import requests as req_lib
from requests.exceptions import RequestException

app = Flask(__name__)

# ── CORS ──────────────────────────────────────────────────────────────────────
_raw_origin = os.getenv("CORS_ORIGIN", "http://localhost:3000")
_cors_origins = [o.strip() for o in _raw_origin.split(",") if o.strip()]
CORS(
    app,
    origins=_cors_origins,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Range"],
    expose_headers=["Content-Length", "Content-Range", "Accept-Ranges"],
    supports_credentials=False,
)

# ── Rate Limiting ─────────────────────────────────────────────────────────────
DEV_MODE = os.getenv("FLASK_ENV", "production") == "development"

if DEV_MODE:
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["1000 per minute"],
        storage_uri="memory://",
    )
else:
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["200 per hour", "60 per minute"],
        storage_uri="memory://",
    )

# ── Security Headers ──────────────────────────────────────────────────────────
@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "img-src 'self' data: https:; "
        "media-src 'self' https: blob:; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com"
    )
    return response

# ── Input Sanitisation ────────────────────────────────────────────────────────
_MAX_QUERY_LEN = 200

def sanitize_query(q: str) -> str | None:
    if not q or not q.strip():
        return None
    if len(q) > _MAX_QUERY_LEN:
        return None
    q = re.sub(r'(?i)(https?|ftp|file)://', '', q)
    return q.strip()

# ============= API ROUTES =============

@app.route('/api/ping', methods=['GET'])
def api_ping():
    """Health check endpoint - no rate limit"""
    return jsonify({"status": "ok"})


@app.route('/api/artist-image', methods=['GET'])
@limiter.limit("120 per minute")
def api_artist_image():
    """Returns the best available artist photo URL. Cached 7 days."""
    name = request.args.get('name', '').strip()
    if not name:
        return jsonify({"image": ""}), 400
    image = lastfm_engine.get_artist_image(name)
    return jsonify({"image": image})

@app.route('/api/search', methods=['POST', 'GET'])
@limiter.limit("60 per minute")
def api_search():
    """Search endpoint returning categorized JSON results"""
    if request.method == 'POST':
        data = request.get_json() or {}
        raw_query = data.get('query', '')
        offset = int(data.get('offset', 0))
    else:
        raw_query = request.args.get('q', '')
        offset = int(request.args.get('offset', 0))

    query = sanitize_query(raw_query)
    if not query:
        return jsonify({"error": "Query is required and must be ≤ 200 characters"}), 400

    try:
        results = hub.search_hybrid(query, categorized=True, offset=offset)
        return jsonify(results)
    except RequestException as e:
        print(f"API SEARCH: Connection lost: {e}", flush=True)
        return jsonify({"error": "Backend could not reach music providers"}), 502
    except Exception as e:
        print(f"API SEARCH: Unexpected error: {e}", flush=True)
        return jsonify({"error": "Internal Server Error"}), 500


@app.route('/api/album/<album_id>', methods=['GET'])
@limiter.limit("120 per minute")
def api_album(album_id):
    """Get album tracks"""
    try:
        album_data = metadata_engine.get_album_tracks(album_id)
        if not album_data:
            return jsonify({"error": "Album not found"}), 404
        return jsonify(album_data)
    except RequestException as e:
        return jsonify({"error": "Failed to fetch album data"}), 502
    except Exception as e:
        print(f"API ALBUM: Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@app.route('/api/artist/<artist_name>', methods=['GET'])
@limiter.limit("120 per minute")
def api_artist(artist_name):
    """Get artist songs"""
    try:
        artist_data = metadata_engine.get_artist_songs(artist_name)
        if not artist_data:
            return jsonify({"error": "Artist not found"}), 404
        return jsonify(artist_data)
    except RequestException as e:
        return jsonify({"error": "Failed to fetch artist data"}), 502
    except Exception as e:
        print(f"API ARTIST: Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@app.route('/api/category/<category_id>', methods=['GET'])
@limiter.limit("120 per minute")
def api_category(category_id):
    """Get curated songs for a specific category"""
    try:
        category_data = metadata_engine.get_category_songs(category_id)
        if not category_data:
            return jsonify({"error": "Category not found"}), 404
        return jsonify(category_data)
    except RequestException as e:
        return jsonify({"error": "Failed to fetch category data"}), 502
    except Exception as e:
        print(f"API CATEGORY: Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@app.route('/api/top-artists', methods=['GET'])
@limiter.limit("60 per minute")
def api_top_artists():
    """Get curated top global artists"""
    try:
        artists_data = metadata_engine.get_top_global_artists()
        if not artists_data:
            return jsonify({"error": "Top artists not found"}), 404
        return jsonify(artists_data)
    except Exception as e:
        print(f"API TOP ARTISTS: Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@app.route('/api/play', methods=['POST'])
@limiter.limit("20 per minute")
def api_play():
    """Get audio stream URL for a song"""
    data = request.get_json() or {}
    raw_search_term = data.get('search_term', '')
    artist_name = data.get('artist', None)

    search_term = sanitize_query(raw_search_term)
    if not search_term:
        return jsonify({"error": "search_term is required and must be ≤ 200 characters"}), 400

    try:
        stream_url, source = hub.get_audio_link(search_term, artist_name=artist_name)

        if not stream_url:
            return jsonify({"error": "Could not find audio stream"}), 404

        if source == 'youtube':
            from urllib.parse import quote
            proxy_url = f"/api/stream?q={quote(search_term)}"
            return jsonify({"stream_url": proxy_url, "source": source})

        if source == 'saavn':
            from urllib.parse import quote
            proxy_url = f"/api/saavn-stream?url={quote(stream_url, safe='')}"
            return jsonify({"stream_url": proxy_url, "source": source})

        return jsonify({"stream_url": stream_url, "source": source})
    except RequestException as e:
        print(f"API PLAY: Connection error: {e}")
        return jsonify({"error": "Failed to resolve stream"}), 502
    except Exception as e:
        print(f"API PLAY: Unexpected error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@app.route('/api/stream', methods=['GET'])
@limiter.limit("30 per minute")
def api_stream():
    """Proxy YouTube audio stream — re-resolves fresh URL on every request with Range support"""
    raw_q = request.args.get('q', '')
    search_term = sanitize_query(raw_q)
    if not search_term:
        return jsonify({"error": "q is required and must be ≤ 200 characters"}), 400

    try:
        stream_url = yt_engine.get_audio_link(search_term)

        if not stream_url:
            return jsonify({"error": "Could not resolve YouTube stream"}), 404

        headers = {'User-Agent': 'Mozilla/5.0'}
        range_header = request.headers.get('Range')
        if range_header:
            headers['Range'] = range_header

        yt_resp = req_lib.get(stream_url, headers=headers, stream=True, timeout=15)

        response_headers = {
            'Content-Type': yt_resp.headers.get('Content-Type', 'audio/webm'),
            'Accept-Ranges': 'bytes',
        }
        if 'Content-Length' in yt_resp.headers:
            response_headers['Content-Length'] = yt_resp.headers['Content-Length']
        if 'Content-Range' in yt_resp.headers:
            response_headers['Content-Range'] = yt_resp.headers['Content-Range']

        request_origin = request.headers.get("Origin", "")
        if request_origin in _cors_origins:
            response_headers["Access-Control-Allow-Origin"] = request_origin
        else:
            response_headers["Access-Control-Allow-Origin"] = "*"

        status_code = yt_resp.status_code

        def generate():
            for chunk in yt_resp.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk

        return Response(
            stream_with_context(generate()),
            status=status_code,
            headers=response_headers
        )
    except RequestException as e:
        print(f"API STREAM: Upstream connection error: {e}")
        return jsonify({"error": "Stream proxy failed"}), 502
    except Exception as e:
        print(f"API STREAM: Proxy error: {e}", flush=True)
        return jsonify({"error": "Internal Server Error"}), 500

@app.route('/api/saavn-stream', methods=['GET'])
@limiter.limit("60 per minute")
def api_saavn_stream():
    """Proxy Saavn CDN audio stream — adds CORS headers + Range support for seeking"""
    from urllib.parse import unquote
    raw_url = request.args.get('url', '')
    cdn_url = unquote(raw_url)

    if not cdn_url or not cdn_url.startswith('https://aac.saavncdn.com/'):
        return jsonify({"error": "Invalid or missing Saavn CDN URL"}), 400

    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.jiosaavn.com/',
        }
        range_header = request.headers.get('Range')
        if range_header:
            headers['Range'] = range_header

        cdn_resp = req_lib.get(cdn_url, headers=headers, stream=True, timeout=15)

        response_headers = {
            'Content-Type': cdn_resp.headers.get('Content-Type', 'audio/mp4'),
            'Accept-Ranges': 'bytes',
        }
        if 'Content-Length' in cdn_resp.headers:
            response_headers['Content-Length'] = cdn_resp.headers['Content-Length']
        if 'Content-Range' in cdn_resp.headers:
            response_headers['Content-Range'] = cdn_resp.headers['Content-Range']

        request_origin = request.headers.get("Origin", "")
        if request_origin in _cors_origins:
            response_headers["Access-Control-Allow-Origin"] = request_origin
        else:
            response_headers["Access-Control-Allow-Origin"] = "*"

        status_code = cdn_resp.status_code

        def generate():
            for chunk in cdn_resp.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk

        return Response(
            stream_with_context(generate()),
            status=status_code,
            headers=response_headers
        )
    except RequestException as e:
        print(f"API SAAVN-STREAM: CDN connection error: {e}")
        return jsonify({"error": "Saavn stream proxy failed"}), 502
    except Exception as e:
        print(f"API SAAVN-STREAM: Proxy error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@app.route('/api/video-preview', methods=['GET'])
@limiter.limit("30 per minute")
def api_video_preview():
    """Get iTunes video preview URL"""
    raw_query = request.args.get('q')
    query = sanitize_query(raw_query or '')
    if not query:
        return jsonify({"error": "Query required and must be ≤ 200 characters"}), 400

    video_url = metadata_engine.get_video_preview(query)
    if not video_url:
        return jsonify({"error": "No video found"}), 404

    return jsonify({"video_url": video_url})


if __name__ == '__main__':
    _debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    if _debug:
        print("⚠️  Running in DEBUG mode — never use this in production!")
    else:
        print("✅ Running in production mode (debug=False)")
    print("For production, use: gunicorn -w 4 -b 0.0.0.0:5000 backend.api:app")
    app.run(debug=_debug, threaded=True, processes=1, port=5000)
