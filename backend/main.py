from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from database import init_db
import threading
import time
import os
import logging
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _scheduled_scan_loop():
    """Run a full scan (library + upgrades) daily at 1 AM."""
    from routes.scan import run_scan, scan_status

    while True:
        now = datetime.now()
        target = now.replace(hour=1, minute=0, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        wait_seconds = (target - now).total_seconds()
        logger.info(f"Next scheduled scan at {target.isoformat()}, sleeping {wait_seconds:.0f}s")
        time.sleep(wait_seconds)

        if scan_status["running"]:
            logger.info("Scheduled scan skipped — scan already in progress")
            continue

        logger.info("Starting scheduled scan (1 AM daily)")
        try:
            music_path = Path(os.environ.get("MUSIC_PATH", "/music"))
            run_scan(music_path)
            logger.info("Scheduled scan complete")
        except Exception as e:
            logger.error(f"Scheduled scan failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    t = threading.Thread(target=_scheduled_scan_loop, daemon=True)
    t.start()
    yield

app = FastAPI(title="plex-dedup", version="0.1.0", lifespan=lifespan)

from routes import scan, dupes, trash, stats, settings, upgrades

app.include_router(scan.router)
app.include_router(dupes.router)
app.include_router(trash.router)
app.include_router(stats.router)
app.include_router(settings.router)
app.include_router(upgrades.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}

# Serve React frontend (added after frontend build)
frontend_dist = Path("/app/frontend/dist")
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
