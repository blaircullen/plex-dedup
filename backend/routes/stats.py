from fastapi import APIRouter
from database import get_db

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("/")
def get_stats():
    with get_db() as db:
        total = db.execute("SELECT COUNT(*) as c FROM tracks WHERE status = 'active'").fetchone()["c"]
        formats = db.execute("""
            SELECT format, COUNT(*) as count
            FROM tracks WHERE status = 'active'
            GROUP BY format ORDER BY count DESC
        """).fetchall()
        total_size = db.execute(
            "SELECT COALESCE(SUM(file_size), 0) as s FROM tracks WHERE status = 'active'"
        ).fetchone()["s"]
        dupe_groups = db.execute("SELECT COUNT(*) as c FROM dupe_groups WHERE resolved = 0").fetchone()["c"]
        resolved_groups = db.execute("SELECT COUNT(*) as c FROM dupe_groups WHERE resolved = 1").fetchone()["c"]
        upgrade_pending = db.execute(
            "SELECT COUNT(*) as c FROM upgrade_queue WHERE status = 'pending'"
        ).fetchone()["c"]

    return {
        "total_tracks": total,
        "formats": [dict(f) for f in formats],
        "total_size_bytes": total_size,
        "total_size_gb": round(total_size / 1024 / 1024 / 1024, 2),
        "dupe_groups_unresolved": dupe_groups,
        "dupe_groups_resolved": resolved_groups,
        "upgrades_pending": upgrade_pending,
    }
