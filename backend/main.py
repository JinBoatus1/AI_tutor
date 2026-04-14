import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api_routes import router as api_router

app = FastAPI()

_raw = os.getenv("CORS_ORIGINS", "*")
# 避免 CORS_ORIGINS= 或空串变成 [""]，浏览器会报 Failed to fetch
origins = [o.strip() for o in _raw.split(",") if o.strip()]
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

_BACKEND_DIR = Path(__file__).resolve().parent
_default_dist = _BACKEND_DIR.parent / "frontend" / "dist"
_dist_env = os.getenv("FRONTEND_DIST", "").strip()
STATIC_ROOT = Path(_dist_env).resolve() if _dist_env else _default_dist


def _frontend_ready() -> bool:
    return STATIC_ROOT.is_dir() and (STATIC_ROOT / "index.html").is_file()


if _frontend_ready():

    @app.get("/")
    async def serve_index():
        return FileResponse(STATIC_ROOT / "index.html")

    _assets = STATIC_ROOT / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    @app.get("/{path:path}")
    async def spa_or_static(path: str):
        # /api/* 已由 router 处理；若落到此处说明无该接口
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = STATIC_ROOT / path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_ROOT / "index.html")

else:

    @app.get("/")
    async def root():
        return {"status": "ok", "msg": "AI Tutor backend running"}
