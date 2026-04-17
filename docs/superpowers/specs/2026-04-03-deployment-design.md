# Deployment Design: Vercel (Frontend) + Render (Backend)

## Goal

Deploy Math AI Tutor to the public internet so it's accessible via a URL and indexable by search engines. Minimize cost and code changes.

## Architecture

```
Browser  ──→  Vercel (xxx.vercel.app)       ← React SPA, global CDN
                 │
                 └── API calls ──→  Render (xxx.onrender.com)  ← FastAPI + OpenAI
```

- **Frontend on Vercel**: Static React build served via Vercel's CDN. Free tier: 100GB bandwidth/month.
- **Backend on Render**: Python FastAPI web service. Free tier: 750 hours/month, auto-sleep after 15 min idle (~30s cold start).

## Current State

### Frontend (React 19 + Vite)
- 3 files make API calls to hardcoded `http://127.0.0.1:8000`:
  - `src/AutoGrader.tsx:19` — `POST /api/grade`
  - `src/UploadTextbook.tsx:39` — `POST /api/upload_textbook`
  - `src/LearningModel.tsx:160` — `POST /api/chat`
- Vite config in `vite.config.ts` — no build config, only dev server settings.
- Client-side routing via react-router-dom (BrowserRouter).

### Backend (FastAPI)
- Entry: `main.py` → includes `api_routes.py` router.
- 3 API endpoints: `/api/chat`, `/api/grade`, `/api/upload_textbook`.
- Uses OpenAI API via `deps.py` (reads `OPENAI_API_KEY` from `.env`).
- Local file storage: `backend/data/FOCS.json`, `FOCS.pdf`, `memory/` (jsonl files), `chat_history.json`.
- CORS already set to `allow_origins=["*"]` — works for cross-origin deployment as-is.

## Changes Required

### 1. Frontend: Extract API base URL to environment variable

**Files to change:** `AutoGrader.tsx`, `UploadTextbook.tsx`, `LearningModel.tsx`

Replace hardcoded `http://127.0.0.1:8000` with `import.meta.env.VITE_API_URL` (Vite convention for client-side env vars).

- Local dev: create `frontend/.env.development` with `VITE_API_URL=http://127.0.0.1:8000`
- Production: set `VITE_API_URL` in Vercel dashboard to the Render backend URL

### 2. Frontend: Add Vercel SPA routing config

**New file:** `frontend/vercel.json`

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

This ensures client-side routes (`/learning`, `/autograder`, `/upload`) work on refresh instead of returning 404.

### 3. Backend: Add Render start command

No code changes needed. Configure in Render dashboard:
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 4. Backend: Tighten CORS for production

Update `main.py` to read allowed origins from env:

```python
origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, ...)
```

Set `CORS_ORIGINS` on Render to the Vercel frontend URL (e.g., `https://ai-tutor2.vercel.app`).

### 5. Environment variables

| Platform | Variable | Value |
|----------|----------|-------|
| Vercel | `VITE_API_URL` | `https://ai-tutor2.onrender.com` (Render URL) |
| Render | `OPENAI_API_KEY` | Your OpenAI API key |
| Render | `CORS_ORIGINS` | `https://ai-tutor2.vercel.app` (Vercel URL) |

## Data & Storage Considerations

- `backend/data/FOCS.json` and `FOCS.pdf` are committed to git — they will be available on Render via the repo.
- `backend/data/memory/` is in `.gitignore` — memory data starts fresh on each deploy. This is acceptable for a free-tier deployment. For persistence, a database (e.g., Render PostgreSQL) would be needed later.
- `chat_history.json` — same situation, ephemeral on free tier.

## Deployment Steps (Manual)

### Vercel (Frontend)
1. Go to vercel.com, sign up / log in with GitHub.
2. Import the `AI_tutor2` repo.
3. Set **Root Directory** to `frontend`.
4. Framework preset: Vite.
5. Add env var `VITE_API_URL` = (Render backend URL, set after Render is up).
6. Deploy.

### Render (Backend)
1. Go to render.com, sign up / log in with GitHub.
2. Create new **Web Service**, connect to `AI_tutor2` repo.
3. Set **Root Directory** to `backend`.
4. **Runtime:** Python.
5. **Build command:** `pip install -r requirements.txt`
6. **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
7. Add env var `OPENAI_API_KEY` and `CORS_ORIGINS`.
8. Deploy.

### Post-deploy
1. Copy the Render URL, set it as `VITE_API_URL` in Vercel, redeploy frontend.
2. Copy the Vercel URL, set it as `CORS_ORIGINS` in Render, redeploy backend.
3. Test all 3 endpoints: chat, grade, upload.

## SEO

The `.vercel.app` domain is indexable by search engines by default. No additional configuration needed. If custom domain is desired later, both Vercel and Render support it in their dashboards.

## Out of Scope

- Custom domain setup (can be added later)
- Database migration for persistent memory/chat history
- CI/CD pipeline customization
- Authentication / rate limiting
