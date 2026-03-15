import multiprocessing

# Binding
bind = "0.0.0.0:5000"

# Worker Options
workers = multiprocessing.cpu_count() * 2 + 1
threads = 2
worker_class = "gthread"
timeout = 120  # Extended timeout for long-running partial content requests
keepalive = 5

# Application
wsgi_app = "backend.api:app"

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
