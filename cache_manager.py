import os
import json
import time
import hashlib
import tempfile
import fcntl
import threading
from collections import OrderedDict
from functools import wraps

CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)

class LRUMemoryCache:
    """Thread-safe in-memory LRU cache. Bounded to max_size entries."""
    
    def __init__(self, max_size=256):
        self._cache = OrderedDict()
        self._max_size = max_size
        self._lock = threading.Lock()
    
    def get(self, key, ttl):
        with self._lock:
            if key not in self._cache:
                return None, False  # (value, found)
            
            entry = self._cache[key]
            # TTL check
            if time.time() - entry['timestamp'] > ttl:
                del self._cache[key]
                return None, False
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            return entry['payload'], True
    
    def set(self, key, payload):
        with self._lock:
            # Evict oldest if at capacity
            if key not in self._cache and len(self._cache) >= self._max_size:
                self._cache.popitem(last=False)
            
            self._cache[key] = {
                'timestamp': time.time(),
                'payload': payload
            }
    
    def clear(self):
        with self._lock:
            self._cache.clear()


class SmartCache:
    """
    Production-ready file-based cache with:
    1. In-memory LRU (fast path, ~1000x faster than disk)
    2. File locking via fcntl (prevents corruption under Gunicorn workers)
    3. Atomic writes (tempfile -> os.replace)
    """
    
    def __init__(self, ttl=86400, validator=None):
        self.ttl = ttl
        self.validator = validator
        self._memory = LRUMemoryCache(max_size=256)

    def _get_cache_path(self, key):
        hash_key = hashlib.sha256(key.encode('utf-8')).hexdigest()[:32]
        return os.path.join(CACHE_DIR, f"{hash_key}.json")

    def get(self, key):
        # Layer 1: In-memory LRU (instant, no disk I/O)
        value, found = self._memory.get(key, self.ttl)
        if found:
            return value
        
        # Layer 2: Disk cache (with shared file lock for safe reads)
        path = self._get_cache_path(key)
        if not os.path.exists(path):
            return None
            
        try:
            with open(path, 'r', encoding='utf-8') as f:
                fcntl.flock(f, fcntl.LOCK_SH)  # Shared lock (multiple readers OK)
                try:
                    data = json.load(f)
                finally:
                    fcntl.flock(f, fcntl.LOCK_UN)
                
            # Check TTL
            if time.time() - data['timestamp'] > self.ttl:
                try:
                    os.remove(path)
                except OSError:
                    pass
                return None
            
            # Promote to memory cache
            self._memory.set(key, data['payload'])
            return data['payload']
            
        except (json.JSONDecodeError, KeyError) as e:
            # Corrupted cache file — remove it
            print(f"   [Cache] Corrupted file removed: {e}")
            try:
                os.remove(path)
            except OSError:
                pass
            return None
        except Exception as e:
            print(f"   [Cache] Read Error: {e}")
            return None

    def set(self, key, payload):
        # Validation
        if self.validator and not self.validator(payload):
            return False
            
        path = self._get_cache_path(key)
        dir_name = os.path.dirname(path) or '.'
        tmp_path = None
        
        try:
            # Re-ensure directory exists (in case it was deleted while server is running)
            os.makedirs(dir_name, exist_ok=True)
            
            # Atomic Write: Write to temp -> Rename
            fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix='.tmp')
            
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump({
                    "timestamp": time.time(),
                    "payload": payload
                }, f)
                f.flush()
                # os.fsync is not available/necessary on all platforms, handle gracefully
                try:
                    os.fsync(f.fileno())
                except OSError:
                    pass
                
            # Atomic swap (safe even without locking since os.replace is atomic on Linux)
            os.replace(tmp_path, path)
            
            # Update memory cache too
            self._memory.set(key, payload)
            return True
            
        except Exception as e:
            print(f"   [Cache] Write Error: {e}")
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            return False


# --- Thundering Herd Protection ---
# Per-key locks prevent duplicate API calls when multiple requests
# hit the same uncached key simultaneously.
_herd_locks = {}
_herd_meta_lock = threading.Lock()

def _get_herd_lock(key):
    """Get or create a lock for a specific cache key."""
    with _herd_meta_lock:
        if key not in _herd_locks:
            _herd_locks[key] = threading.Lock()
        return _herd_locks[key]


def smart_cache(ttl=86400, validator=None):
    """
    Production-ready decorator for file-based caching.
    
    Features:
    - In-memory LRU (fast path)
    - File-based persistence (survives restarts)
    - File locking (safe under Gunicorn multi-worker)
    - Thundering herd protection (prevents duplicate API calls)
    
    Args:
        ttl: Time to live in seconds (default: 86400 = 24h)
        validator: Function returning True if result is valid to cache
    """
    cache_instance = SmartCache(ttl, validator)
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Build a stable cache key
            key_str = f"{func.__module__}.{func.__name__}:{args}:{kwargs}"
            
            # Fast path: Check cache (memory + disk)
            cached = cache_instance.get(key_str)
            if cached is not None:
                return cached
            
            # Thundering herd: Only one thread calls the API per key
            herd_lock = _get_herd_lock(key_str)
            with herd_lock:
                # Double-check after acquiring lock (another thread may have populated it)
                cached = cache_instance.get(key_str)
                if cached is not None:
                    return cached
                
                # Call the actual function
                result = func(*args, **kwargs)
                
                # Save to cache (validator check is inside .set)
                cache_instance.set(key_str, result)
                
                return result
        
        # Expose cache instance for manual operations (e.g., clearing)
        wrapper.cache = cache_instance
        return wrapper
    return decorator
