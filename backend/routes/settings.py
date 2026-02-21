from fastapi import APIRouter
from database import get_db
import os

router = APIRouter(prefix="/api/settings", tags=["settings"])

DEFAULTS = {
    "fingerprint_threshold": "0.85",
    "squid_rate_limit": "3",
    "auto_resolve_threshold": "0.95",
    "upgrade_scan_folders": "",
}

@router.get("/")
def get_settings():
    settings = dict(DEFAULTS)
    settings["music_path"] = os.environ.get("MUSIC_PATH", "/music")
    settings["trash_path"] = os.environ.get("TRASH_PATH", "/trash")
    with get_db() as db:
        rows = db.execute("SELECT key, value FROM settings").fetchall()
        for row in rows:
            settings[row["key"]] = row["value"]
    return settings

@router.put("/")
def update_settings(data: dict):
    with get_db() as db:
        for key, value in data.items():
            if key in ("music_path", "trash_path"):
                continue  # read-only
            db.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                (key, str(value))
            )
    return get_settings()
