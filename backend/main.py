from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from database import init_db

app = FastAPI(title="plex-dedup", version="0.1.0")

@app.on_event("startup")
def startup():
    init_db()

@app.get("/api/health")
def health():
    return {"status": "ok"}

# Serve React frontend (added after frontend build)
frontend_dist = Path("/app/frontend/dist")
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
