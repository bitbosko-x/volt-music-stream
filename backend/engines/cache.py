import os
import json
import time
import hashlib
import tempfile
import fcntl
import threading
import weakref
from collections import OrderedDict
from functools import wraps

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cache")
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
    
    def __init__(self, ttl=86400, validator=None, max_files=2000):
        self.ttl = ttl
        self.validator = validator
        self.max_files = max_files
        self._memory = LRUMemoryCache(max_size=256)

    def _evict_oldest_if_full(self, dir_name):
        """Remove the oldest cache file if we're at the file cap."""
        try:
            files = [
                os.path.join(dir_name, f)
                for f in os.listdir(dir_name)
                if f.endswith('.json')
            ]
            if len(files) >= self.max_files:
                oldest = min(files, key=os.path.getmtime)
                os.remove(oldest)
                print(f"   [Cache] Evicted oldest file to stay under {self.max_files} limit: {oldest}")
        except OSError:
            pass  # Non-fatal — worst case we slightly exceed the cap

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

            # Enforce disk cap before writing a new file
            self._evict_oldest_if_full(dir_name)

            # Atomic Write: Write to temp -> Rename
            fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix='.tmp')

            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                fcntl.flock(f, fcntl.LOCK_EX)  # Exclusive lock for cross-process safety
                try:
                    json.dump({
                        "timestamp": time.time(),
                        "payload": payload
                    }, f)
                    f.flush()
                    try:
                        os.fsync(f.fileno())
                    except OSError:
                        pass
                finally:
                    fcntl.flock(f, fcntl.LOCK_UN)

            # Atomic swap — last writer wins, but both are valid JSON
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
_herd_locks = weakref.WeakValueDictionary()
_herd_meta_lock = threading.Lock()

def _get_herd_lock(key):
    """Get or create a lock for a specific cache key."""
    with _herd_meta_lock:
        lock = _herd_locks.get(key)
        if lock is None:
            lock = threading.Lock()
            _herd_locks[key] = lock
        return lock


def smart_cache(ttl=86400, validator=None):
    """
    Production-ready decorator for file-based caching.
    """
    cache_instance = SmartCache(ttl, validator)
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key_str = f"{func.__module__}.{func.__name__}:{args}:{kwargs}"
            
            cached = cache_instance.get(key_str)
            if cached is not None:
                return cached
            
            herd_lock = _get_herd_lock(key_str)
            with herd_lock:
                cached = cache_instance.get(key_str)
                if cached is not None:
                    return cached
                
                result = func(*args, **kwargs)
                cache_instance.set(key_str, result)
                return result
        
        wrapper.cache = cache_instance
        return wrapper
    return decorator
