---
description: Clear the Volt cache directory to force fresh data fetches from music providers
---

## When to Use
- After making changes to search/metadata logic that should produce new results
- When cached results seem stale or incorrect
- To free disk space occupied by old cached files

## Steps

1. **Navigate to the cache directory and view its current contents**
   ```bash
   ls /home/mak/Volt/cache/
   ```

2. **Clear all cached files**
   ```bash
   rm -f /home/mak/Volt/cache/*.json
   ```
   > ⚠️ This removes ALL cache entries. The next set of requests will hit JioSaavn/YouTube/iTunes APIs directly, which may be temporarily slower until the cache rebuilds.

3. **Selectively clear a single cache entry** (optional)
   If you know the cache key (a hex filename like `0bd34944bbad2820a70eb4c349d260ae.json`), delete only that file:
   ```bash
   rm /home/mak/Volt/cache/<filename>.json
   ```

4. **Restart the Flask server** to ensure `cache_manager.py` resets its in-memory state:
   ```bash
   # If running with Gunicorn:
   kill $(cat /tmp/volt.pid) && gunicorn -c gunicorn_config.py api:app

   # If running in dev mode (Ctrl+C then):
   FLASK_ENV=development python api.py
   ```
