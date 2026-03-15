---
description: Deploy Volt to production using Gunicorn (backend) and a static build (frontend)
---

## Steps

### Backend (Gunicorn)

1. **Activate virtual environment**
   ```bash
   cd /home/mak/Volt
   source venv/bin/activate
   ```

2. **Set production environment variables in `.env`**
   ```
   FLASK_ENV=production
   CORS_ORIGIN=https://your-frontend-domain.com
   ```

3. **Start Gunicorn with the config file**
   ```bash
   gunicorn -c gunicorn_config.py api:app
   ```
   This binds to `0.0.0.0:5000` with `cpu_count * 2 + 1` gthread workers, 120s timeout.

4. **(Optional) Run as a background process**
   ```bash
   gunicorn -c gunicorn_config.py api:app --daemon \
     --pid /tmp/volt.pid \
     --access-logfile /var/log/volt-access.log \
     --error-logfile /var/log/volt-error.log
   ```

---

### Frontend (Vite Build)

5. **Build the production bundle**
   ```bash
   cd /home/mak/Volt/frontend
   npm run build
   ```
   Output is in `frontend/dist/`.

6. **Deploy `dist/` to your static host** (e.g. Netlify, Vercel, Nginx)
   - The project includes a `netlify.toml` for Netlify deployments.
   - For Nginx, serve the `dist/` directory and proxy `/api/*` to `http://localhost:5000`.

---

### Verify Production

7. **Check health**
   ```bash
   curl https://your-domain.com/api/ping
   # Expected: {"status": "ok"}
   ```

8. **Confirm rate limiting is active** (prod: 200/hr + 60/min per IP)
