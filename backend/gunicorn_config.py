import os

# Render (and most PaaS) assign a dynamic port via $PORT.
# Fall back to 5000 for local dev.
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"

# Cap at 2 workers on free-tier hosts (512 MB RAM).
# Each worker + yt-dlp easily uses 100-150 MB.
workers = int(os.environ.get('WEB_CONCURRENCY', 2))
threads = 4
worker_class = "gthread"
timeout = 180  # Extended for slow YouTube/Saavn fallback requests
keepalive = 5

# Application entry point
wsgi_app = "api:app"

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
