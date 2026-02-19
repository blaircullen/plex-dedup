from fastapi import APIRouter
from database import get_db
from dedup import group_by_metadata, find_duplicates
from file_manager import trash_file
from pathlib import Path
import os

router = APIRouter(prefix="/api/dupes", tags=["dupes"])

@router.post("/analyze")
def analyze_dupes():
    with get_db() as db:
        rows = db.execute("SELECT * FROM tracks WHERE status = 'active'").fetchall()
        tracks = [dict(r) for r in rows]

    groups = group_by_metadata(tracks)
    results = []

    with get_db() as db:
        db.execute("DELETE FROM dupe_group_members WHERE group_id IN (SELECT id FROM dupe_groups WHERE resolved = 0)")
        db.execute("DELETE FROM dupe_groups WHERE resolved = 0")

        for group in groups:
            result = find_duplicates(group)
            cursor = db.execute(
                "INSERT INTO dupe_groups (match_type, confidence, kept_track_id) VALUES (?, ?, ?)",
                ("metadata", 0.0, result["keep_id"])
            )
            group_id = cursor.lastrowid
            for track in group:
                db.execute(
                    "INSERT INTO dupe_group_members (group_id, track_id) VALUES (?, ?)",
                    (group_id, track["id"])
                )
            results.append({"group_id": group_id, **result})

    return {"groups_found": len(results), "results": results}

@router.get("/")
def list_dupes(resolved: bool = False):
    with get_db() as db:
        groups = db.execute("""
            SELECT dg.*, GROUP_CONCAT(dgm.track_id) as member_ids
            FROM dupe_groups dg
            JOIN dupe_group_members dgm ON dg.id = dgm.group_id
            WHERE dg.resolved = ?
            GROUP BY dg.id
        """, (int(resolved),)).fetchall()

        result = []
        for g in groups:
            member_ids = [int(x) for x in g["member_ids"].split(",")]
            placeholders = ",".join("?" * len(member_ids))
            members = db.execute(
                f"SELECT * FROM tracks WHERE id IN ({placeholders})", member_ids
            ).fetchall()
            result.append({
                "group": dict(g),
                "members": [dict(m) for m in members]
            })

    return result

@router.post("/{group_id}/resolve")
def resolve_group(group_id: int, keep_track_id: int):
    trash_dir = Path(os.environ.get("TRASH_PATH", "/trash"))
    music_root = Path(os.environ.get("MUSIC_PATH", "/music"))

    with get_db() as db:
        members = db.execute(
            "SELECT track_id FROM dupe_group_members WHERE group_id = ?", (group_id,)
        ).fetchall()
        member_ids = [m["track_id"] for m in members]

        for tid in member_ids:
            if tid == keep_track_id:
                continue
            track = db.execute("SELECT * FROM tracks WHERE id = ?", (tid,)).fetchone()
            if track:
                dest = trash_file(Path(track["file_path"]), trash_dir, music_root)
                db.execute("UPDATE tracks SET status = 'trashed' WHERE id = ?", (tid,))
                db.execute(
                    "INSERT INTO file_actions (track_id, action, source_path, dest_path) VALUES (?, 'trash', ?, ?)",
                    (tid, track["file_path"], dest)
                )

        db.execute(
            "UPDATE dupe_groups SET resolved = 1, kept_track_id = ? WHERE id = ?",
            (keep_track_id, group_id)
        )

    return {"status": "resolved", "kept": keep_track_id}

@router.post("/resolve-all")
def resolve_all():
    with get_db() as db:
        groups = db.execute(
            "SELECT id, kept_track_id FROM dupe_groups WHERE resolved = 0"
        ).fetchall()

    resolved = 0
    for g in groups:
        resolve_group(g["id"], g["kept_track_id"])
        resolved += 1

    return {"resolved": resolved}
