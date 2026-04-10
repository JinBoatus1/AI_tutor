import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_routes import router as api_router
import database


app = FastAPI()

origins = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    try:
        database.init_db()
    except Exception as e:
        print(f"[DB] MongoDB init failed: {e}", flush=True)


app.include_router(api_router)


@app.get("/")
async def root():
    return {"status": "ok", "msg": "AI Tutor backend running"}
