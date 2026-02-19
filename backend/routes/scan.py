from fastapi import APIRouter, BackgroundTasks, WebSocket
from database import get_db
from scanner import scan_directory, generate_fingerprint, AUDIO_EXTENSIONS
from pathlib import Path
import asyncio
import os

router = APIRouter(prefix="/api/scan", tags=["scan"])

scan_status = {"running": False, "progress": 0, "total": 0, "current_file": ""}
ws_clients: list[WebSocket] = []

async def broadcast(data: dict):
    for ws in ws_clients[:]:
        try:
            await ws.send_json(data)
        except Exception:
            ws_clients.remove(ws)

@router.websocket("/ws")
async def scan_websocket(websocket: WebSocket):
    await websocket.accept()
    ws_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        ws_clients.remove(websocket)

@router.post("/start")
async def start_scan(background_tasks: BackgroundTasks):
    if scan_status["running"]:
        return {"error": "Scan already in progress"}
    music_path = Path(os.environ.get("MUSIC_PATH", "/music"))
    background_tasks.add_task(run_scan, music_path)
    return {"status": "started"}

@router.get("/status")
def get_scan_status():
    return scan_status

def _broadcast_sync(data: dict):
    """Broadcast from sync context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(broadcast(data))
        else:
            loop.run_until_complete(broadcast(data))
    except RuntimeError:
        pass

def run_scan(music_path: Path):
    scan_status["running"] = True
    scan_status["progress"] = 0

    # Fast file count — just check extensions, no metadata reads
    total = 0
    for dirpath, _, filenames in os.walk(music_path):
        for f in filenames:
            if Path(f).suffix.lower() in AUDIO_EXTENSIONS:
                total += 1
    scan_status["total"] = total

    with get_db() as db:
        for i, meta in enumerate(scan_directory(music_path)):
            scan_status["progress"] = i + 1
            scan_status["current_file"] = meta["file_path"]

            if (i + 1) % 10 == 0 or i + 1 == total:
                _broadcast_sync(dict(scan_status))

            existing = db.execute(
                "SELECT id FROM tracks WHERE file_path = ?", (meta["file_path"],)
            ).fetchone()
            if existing:
                continue

            fp = generate_fingerprint(meta["file_path"])
            meta["fingerprint"] = fp

            db.execute("""
                INSERT INTO tracks (file_path, file_size, format, bitrate, bit_depth,
                    sample_rate, duration, artist, album_artist, album, title,
                    track_number, disc_number, fingerprint)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                meta["file_path"], meta["file_size"], meta["format"], meta["bitrate"],
                meta["bit_depth"], meta["sample_rate"], meta["duration"], meta["artist"],
                meta["album_artist"], meta["album"], meta["title"], meta["track_number"],
                meta["disc_number"], meta["fingerprint"]
            ))

    scan_status["running"] = False
    _broadcast_sync(dict(scan_status))
