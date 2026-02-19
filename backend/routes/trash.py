from fastapi import APIRouter
from database import get_db
from file_manager import restore_file, get_trash_size, empty_trash
from pathlib import Path
import os

router = APIRouter(prefix="/api/trash", tags=["trash"])

@router.get("/")
def list_trash():
    with get_db() as db:
        items = db.execute("""
            SELECT fa.*, t.artist, t.title, t.album, t.format
            FROM file_actions fa
            JOIN tracks t ON fa.track_id = t.id
            WHERE fa.action = 'trash' AND t.status = 'trashed'
            ORDER BY fa.performed_at DESC
        """).fetchall()
    return [dict(i) for i in items]

@router.get("/size")
def trash_size():
    trash_dir = Path(os.environ.get("TRASH_PATH", "/trash"))
    size = get_trash_size(trash_dir)
    return {"size_bytes": size, "size_mb": round(size / 1024 / 1024, 2)}

@router.post("/{action_id}/restore")
def restore(action_id: int):
    with get_db() as db:
        action = db.execute("SELECT * FROM file_actions WHERE id = ?", (action_id,)).fetchone()
        if not action:
            return {"error": "Action not found"}
        restore_file(action["dest_path"], action["source_path"])
        db.execute("UPDATE tracks SET status = 'active' WHERE id = ?", (action["track_id"],))
        db.execute("DELETE FROM file_actions WHERE id = ?", (action_id,))
    return {"status": "restored"}

@router.post("/empty")
def empty():
    trash_dir = Path(os.environ.get("TRASH_PATH", "/trash"))
    count = empty_trash(trash_dir)
    with get_db() as db:
        db.execute("UPDATE tracks SET status = 'deleted' WHERE status = 'trashed'")
    return {"deleted": count}
