import multiprocessing

# Binding
bind = "0.0.0.0:5000"

# Worker Options
workers = multiprocessing.cpu_count() * 2 + 1
threads = 4
worker_class = "gthread"
timeout = 180  # Extended for slow YouTube/Saavn fallback requests
keepalive = 5

# Application — supports both `cd backend && gunicorn ...` and root-level invocation
wsgi_app = "api:app"

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
