import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/")
async def root():
    return {"status": "ok", "msg": "AI Tutor backend running"}
