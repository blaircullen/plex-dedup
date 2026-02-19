from fastapi import APIRouter, BackgroundTasks
from database import get_db
from upgrade_service import build_search_query

router = APIRouter(prefix="/api/upgrades", tags=["upgrades"])

@router.get("/candidates")
def get_upgrade_candidates():
    """Find MP3-only tracks that could be upgraded to FLAC."""
    with get_db() as db:
        candidates = db.execute("""
            SELECT t.* FROM tracks t
            WHERE t.format IN ('mp3', 'aac', 'ogg', 'm4a')
            AND t.status = 'active'
            AND t.id NOT IN (
                SELECT dgm.track_id FROM dupe_group_members dgm
                JOIN dupe_groups dg ON dgm.group_id = dg.id
                WHERE dg.resolved = 1
            )
            ORDER BY t.artist, t.album, t.track_number
        """).fetchall()
    return [dict(c) for c in candidates]

@router.post("/scan")
async def scan_for_upgrades(background_tasks: BackgroundTasks):
    """Search squid.wtf for FLAC upgrades of all MP3 candidates."""
    with get_db() as db:
        candidates = db.execute("""
            SELECT * FROM tracks
            WHERE format IN ('mp3', 'aac', 'ogg', 'm4a')
            AND status = 'active'
            AND id NOT IN (SELECT track_id FROM upgrade_queue)
        """).fetchall()

        for c in candidates:
            query = build_search_query(dict(c))
            db.execute(
                "INSERT INTO upgrade_queue (track_id, search_query, status) VALUES (?, ?, 'pending')",
                (c["id"], query)
            )

    return {"queued": len(candidates)}

@router.get("/queue")
def get_queue(status: str = None):
    with get_db() as db:
        if status:
            items = db.execute("""
                SELECT uq.*, t.artist, t.title, t.album, t.format, t.bitrate
                FROM upgrade_queue uq
                JOIN tracks t ON uq.track_id = t.id
                WHERE uq.status = ?
                ORDER BY uq.created_at DESC
            """, (status,)).fetchall()
        else:
            items = db.execute("""
                SELECT uq.*, t.artist, t.title, t.album, t.format, t.bitrate
                FROM upgrade_queue uq
                JOIN tracks t ON uq.track_id = t.id
                ORDER BY uq.created_at DESC
            """).fetchall()
    return [dict(i) for i in items]

@router.post("/queue/{item_id}/approve")
def approve_upgrade(item_id: int):
    with get_db() as db:
        db.execute("UPDATE upgrade_queue SET status = 'approved' WHERE id = ?", (item_id,))
    return {"status": "approved"}

@router.post("/queue/{item_id}/skip")
def skip_upgrade(item_id: int):
    with get_db() as db:
        db.execute("UPDATE upgrade_queue SET status = 'skipped' WHERE id = ?", (item_id,))
    return {"status": "skipped"}
