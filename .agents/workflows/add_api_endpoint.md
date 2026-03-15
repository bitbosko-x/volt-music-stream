---
description: How to add a new REST API endpoint to the Volt Flask backend
---

## Steps

1. **Open `api.py`** and add your route at the appropriate location (after the existing routes, before `if __name__ == '__main__'`).

2. **Define the route** using Flask decorators and apply a rate limit:
   ```python
   @app.route('/api/your-endpoint', methods=['GET'])
   @limiter.limit("60 per minute")
   def api_your_endpoint():
       """Description of what this endpoint does."""
       raw_q = request.args.get('q', '')
       query = sanitize_query(raw_q)
       if not query:
           return jsonify({"error": "Query required and must be ≤ 200 characters"}), 400

       try:
           result = some_engine.do_something(query)
           if not result:
               return jsonify({"error": "Not found"}), 404
           return jsonify(result)
       except RequestException as e:
           return jsonify({"error": "Upstream connection failed"}), 502
       except Exception as e:
           print(f"API YOUR_ENDPOINT: Error: {e}")
           return jsonify({"error": "Internal Server Error"}), 500
   ```

3. **Always use `sanitize_query()`** for any user-supplied strings — it enforces the 200-char max and strips URL schemes.

4. **Always handle** `RequestException` (upstream failures → 502) and generic `Exception` (→ 500).

5. **Add the endpoint to the summary table** in `Volt.md` and in the project summary artifact.

6. **Test the new endpoint** using the Run Tests workflow.
