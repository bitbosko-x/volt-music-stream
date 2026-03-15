---
description: Start both the backend Flask API and the frontend Vite dev server for local development
---

## Prerequisites
- Python venv is set up at `Volt/venv/`
- Node.js + npm installed
- `.env` file configured (see `.env` for CORS_ORIGIN, etc.)

## Steps

1. **Activate Python virtual environment and start the Flask backend**
   ```bash
   cd /home/mak/Volt
   source venv/bin/activate
   FLASK_ENV=development python api.py
   ```
   The API will be available at `http://localhost:5000`.

2. **In a second terminal, start the Vite frontend dev server**
   ```bash
   cd /home/mak/Volt/frontend
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173` (or port shown in terminal).

3. **Verify both are running**
   - Backend health: `curl http://localhost:5000/api/ping` → should return `{"status": "ok"}`
   - Frontend: Open `http://localhost:5173` in your browser

> **Tip:** Make sure `CORS_ORIGIN` in `.env` includes `http://localhost:5173` so the frontend can reach the backend.
