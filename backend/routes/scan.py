from fastapi import APIRouter, BackgroundTasks, WebSocket
from database import get_db
from scanner import scan_directory, generate_fingerprint, AUDIO_EXTENSIONS
from dedup import group_by_metadata, find_duplicates
from routes.dupes import auto_resolve_high_confidence
from pathlib import Path
import asyncio
import os
import time
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scan", tags=["scan"])

scan_status = {
    "running": False, "progress": 0, "total": 0, "current_file": "",
    "phase": "idle", "started_at": None, "stale_removed": 0,
}
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
    scan_status["phase"] = "counting"
    scan_status["started_at"] = time.time()
    scan_status["stale_removed"] = 0
    scan_status["current_file"] = ""

    try:
        # Phase 1: Count files
        total = 0
        for dirpath, _, filenames in os.walk(music_path):
            for f in filenames:
                if Path(f).suffix.lower() in AUDIO_EXTENSIONS:
                    total += 1
        scan_status["total"] = total

        # Phase 2: Scan new files
        scan_status["phase"] = "scanning"
        with get_db() as db:
            for i, meta in enumerate(scan_directory(music_path)):
                scan_status["progress"] = i + 1
                scan_status["current_file"] = meta["file_path"]

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

        # Phase 3: Remove stale records (files that no longer exist on disk)
        scan_status["phase"] = "cleaning"
        scan_status["current_file"] = "Removing stale records..."
        stale_count = 0
        with get_db() as db:
            active_tracks = db.execute(
                "SELECT id, file_path FROM tracks WHERE status = 'active'"
            ).fetchall()
            for track in active_tracks:
                if not os.path.exists(track["file_path"]):
                    db.execute(
                        "UPDATE tracks SET status = 'deleted' WHERE id = ?", (track["id"],)
                    )
                    stale_count += 1
        if stale_count > 0:
            logger.info(f"Removed {stale_count} stale track records (files no longer on disk)")
        scan_status["stale_removed"] = stale_count

        # Phase 4: Analyze duplicates
        scan_status["phase"] = "analyzing"
        scan_status["current_file"] = "Analyzing duplicates..."
        try:
            with get_db() as db2:
                rows = db2.execute("SELECT * FROM tracks WHERE status = 'active'").fetchall()
                tracks = [dict(r) for r in rows]
                groups = group_by_metadata(tracks)

                db2.execute("DELETE FROM dupe_group_members WHERE group_id IN (SELECT id FROM dupe_groups WHERE resolved = 0)")
                db2.execute("DELETE FROM dupe_groups WHERE resolved = 0")

                for group in groups:
                    result = find_duplicates(group)
                    cursor = db2.execute(
                        "INSERT INTO dupe_groups (match_type, confidence, kept_track_id) VALUES (?, ?, ?)",
                        ("metadata", result["confidence"], result["keep_id"])
                    )
                    group_id = cursor.lastrowid
                    for track in group:
                        db2.execute(
                            "INSERT INTO dupe_group_members (group_id, track_id) VALUES (?, ?)",
                            (group_id, track["id"])
                        )
            logger.info(f"Auto-analysis found {len(groups)} duplicate groups")
            auto_resolved = auto_resolve_high_confidence()
            if auto_resolved > 0:
                logger.info(f"Auto-resolved {auto_resolved} high-confidence duplicates after scan")
        except Exception as e:
            logger.error(f"Auto duplicate analysis failed: {e}")

        scan_status["phase"] = "complete"
    finally:
        scan_status["running"] = False
