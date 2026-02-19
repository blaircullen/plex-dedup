from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="plex-dedup", version="0.1.0", lifespan=lifespan)

from routes import scan, dupes, trash, stats, settings

app.include_router(scan.router)
app.include_router(dupes.router)
app.include_router(trash.router)
app.include_router(stats.router)
app.include_router(settings.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}

# Serve React frontend (added after frontend build)
frontend_dist = Path("/app/frontend/dist")
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
