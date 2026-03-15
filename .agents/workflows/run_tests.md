---
description: Run backend tests and verify search engine correctness
---

## Steps

1. **Activate the virtual environment**
   ```bash
   cd /home/mak/Volt
   source venv/bin/activate
   ```

2. **Run the Saavn search tests**
   ```bash
   python test_saavn.py
   ```
   Expected output is logged to `tests_out.txt` for comparison.

3. **Manually test the live API endpoints**
   ```bash
   # Health check
   curl http://localhost:5000/api/ping

   # Search
   curl -X POST http://localhost:5000/api/search \
     -H "Content-Type: application/json" \
     -d '{"query": "Blinding Lights"}'

   # Play (resolve stream URL)
   curl -X POST http://localhost:5000/api/play \
     -H "Content-Type: application/json" \
     -d '{"search_term": "Blinding Lights", "artist": "The Weeknd"}'
   ```

4. **Review output**
   - Compare new output against `tests_out.txt` to detect regressions
   - Check for unexpected remix/cover results in song searches
