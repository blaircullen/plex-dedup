from fastapi import APIRouter, BackgroundTasks
from database import get_db
from upgrade_service import (
    build_search_query, find_and_match_track, find_album_match,
    get_album_tracks, get_download_url, download_flac, QUALITY_HI_RES,
)
from dedup import normalize_text
from file_manager import trash_file
from scanner import read_track_metadata
from pathlib import Path
import os
import shutil
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/upgrades", tags=["upgrades"])

upgrade_status = {"running": False, "progress": 0, "total": 0, "current": "", "phase": "idle"}


def _get_upgrade_folders() -> list[str]:
    """Get upgrade scan folders from DB settings, defaulting to all of /music."""
    with get_db() as db:
        row = db.execute("SELECT value FROM settings WHERE key = 'upgrade_scan_folders'").fetchone()
    if row and row["value"]:
        folders = [f.strip() for f in row["value"].split(",") if f.strip()]
        if folders:
            return folders
    music_path = os.environ.get("MUSIC_PATH", "/music")
    return [music_path + "/"]


@router.get("/candidates")
def get_upgrade_candidates():
    """Find lossy tracks that could be upgraded to FLAC."""
    folders = _get_upgrade_folders()
    path_filters = " OR ".join(["t.file_path LIKE ?" for _ in folders])
    path_params = [f"{folder}%" for folder in folders]
    with get_db() as db:
        candidates = db.execute(f"""
            SELECT t.* FROM tracks t
            WHERE t.format IN ('mp3', 'aac', 'ogg', 'm4a')
            AND t.status = 'active'
            AND ({path_filters})
            AND t.id NOT IN (
                SELECT dgm.track_id FROM dupe_group_members dgm
                JOIN dupe_groups dg ON dgm.group_id = dg.id
                WHERE dg.resolved = 1
            )
            ORDER BY t.artist, t.album, t.track_number
        """, path_params).fetchall()
    return [dict(c) for c in candidates]


def queue_upgrade_candidates() -> int:
    """Queue lossy tracks for upgrade search. Returns count of newly queued candidates."""
    folders = _get_upgrade_folders()

    with get_db() as db:
        # Remove any queue items outside allowed folders (cleanup from before filtering)
        path_conditions = " AND ".join([f"t.file_path NOT LIKE '{f}%'" for f in folders])
        db.execute(f"""
            DELETE FROM upgrade_queue WHERE track_id IN (
                SELECT t.id FROM tracks t WHERE {path_conditions}
            )
        """)

        # Reset failed/skipped items so they get retried
        db.execute("""
            UPDATE upgrade_queue
            SET status = 'pending', match_type = NULL, squid_url = NULL
            WHERE status IN ('failed', 'skipped')
        """)

        path_filters = " OR ".join(["file_path LIKE ?" for _ in folders])
        path_params = [f"{folder}%" for folder in folders]
        candidates = db.execute(f"""
            SELECT * FROM tracks
            WHERE format IN ('mp3', 'aac', 'ogg', 'm4a')
            AND status = 'active'
            AND ({path_filters})
            AND id NOT IN (SELECT track_id FROM upgrade_queue)
        """, path_params).fetchall()

        for c in candidates:
            query = build_search_query(dict(c))
            db.execute(
                "INSERT INTO upgrade_queue (track_id, search_query, status) VALUES (?, ?, 'pending')",
                (c["id"], query)
            )

    return len(candidates)


@router.post("/scan")
async def scan_for_upgrades(background_tasks: BackgroundTasks):
    """Search squid.wtf for FLAC upgrades of all lossy candidates."""
    if upgrade_status["running"]:
        return {"error": "Upgrade scan already in progress"}

    queued = queue_upgrade_candidates()
    background_tasks.add_task(run_upgrade_search)
    return {"queued": queued}


@router.get("/status")
def get_upgrade_status():
    return upgrade_status


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
        row = db.execute(
            "SELECT squid_url FROM upgrade_queue WHERE id = ?", (item_id,)
        ).fetchone()
        if not row:
            return {"error": "Item not found"}
        if not row["squid_url"] or row["squid_url"] == "None":
            return {"error": "Cannot approve: no download URL found. Run search first."}
        db.execute("UPDATE upgrade_queue SET status = 'approved' WHERE id = ?", (item_id,))
    return {"status": "approved"}


@router.post("/queue/{item_id}/skip")
def skip_upgrade(item_id: int):
    with get_db() as db:
        db.execute("UPDATE upgrade_queue SET status = 'skipped' WHERE id = ?", (item_id,))
    return {"status": "skipped"}


@router.post("/approve-all-exact")
def approve_all_exact():
    """Approve all queued items with exact matches that have valid download URLs."""
    with get_db() as db:
        result = db.execute(
            "UPDATE upgrade_queue SET status = 'approved' "
            "WHERE match_type = 'exact' AND status = 'pending' "
            "AND squid_url IS NOT NULL AND squid_url != 'None'"
        )
        count = result.rowcount
    return {"approved": count}


@router.post("/download-approved")
async def download_approved(background_tasks: BackgroundTasks):
    """Start downloading all approved upgrades."""
    if upgrade_status["running"]:
        return {"error": "Upgrade already in progress"}

    with get_db() as db:
        count = db.execute("""
            SELECT COUNT(*) FROM upgrade_queue
            WHERE status = 'approved'
              AND squid_url IS NOT NULL
              AND squid_url != 'None'
        """).fetchone()[0]

    if count == 0:
        return {"error": "No approved items with valid download URLs", "count": 0}

    background_tasks.add_task(run_downloads)
    return {"status": "started", "count": count}


async def _find_track_with_cache(
    artist: str, album: str, title: str, track_number: int,
    album_cache: dict[tuple[str, str], dict | None], rate_limit: float = 3.0,
) -> dict | None:
    """Find a track on Tidal, caching album lookups to avoid redundant API calls."""
    cache_key = (normalize_text(artist), normalize_text(album))

    if cache_key not in album_cache:
        album_match = await find_album_match(artist, album, rate_limit)
        album_cache[cache_key] = album_match

    album_match = album_cache[cache_key]
    if not album_match:
        return None

    tracks = await get_album_tracks(album_match["tidal_id"], rate_limit)
    n_title = normalize_text(title)

    # Try track number + title match first
    if track_number > 0:
        for t in tracks:
            if t["track_number"] == track_number and normalize_text(t["title"]) == n_title:
                return {**t, "match_type": "exact", "album_tidal_id": album_match["tidal_id"]}

    # Exact title match
    for t in tracks:
        if normalize_text(t["title"]) == n_title:
            return {**t, "match_type": "exact", "album_tidal_id": album_match["tidal_id"]}

    # Fuzzy title match
    for t in tracks:
        t_title = normalize_text(t["title"])
        if n_title in t_title or t_title in n_title:
            return {**t, "match_type": "fuzzy", "album_tidal_id": album_match["tidal_id"]}

    return None


def run_upgrade_search():
    """Background task: search squid.wtf for each pending queue item."""
    upgrade_status["running"] = True
    upgrade_status["phase"] = "searching"

    with get_db() as db:
        pending = db.execute(
            "SELECT uq.*, t.artist, t.title, t.album, t.track_number "
            "FROM upgrade_queue uq JOIN tracks t ON uq.track_id = t.id "
            "WHERE uq.status = 'pending'"
        ).fetchall()

    upgrade_status["total"] = len(pending)

    # Cache album search results to avoid redundant API calls
    album_cache: dict[tuple[str, str], dict | None] = {}

    try:
        for i, item in enumerate(pending):
            upgrade_status["progress"] = i + 1
            upgrade_status["current"] = f"{item['artist']} - {item['title']}"

            try:
                match = asyncio.run(_find_track_with_cache(
                    artist=item["artist"],
                    album=item["album"],
                    title=item["title"],
                    track_number=item["track_number"],
                    album_cache=album_cache,
                    rate_limit=3.0,
                ))

                with get_db() as db:
                    if match and match.get("tidal_id") is not None:
                        db.execute("""
                            UPDATE upgrade_queue
                            SET match_type = ?, squid_url = ?, status = ?
                            WHERE id = ?
                        """, (
                            match["match_type"],
                            str(match["tidal_id"]),
                            "pending",  # stays pending until approved
                            item["id"],
                        ))
                    else:
                        db.execute(
                            "UPDATE upgrade_queue SET match_type = 'none', status = 'skipped' WHERE id = ?",
                            (item["id"],)
                        )
            except Exception as e:
                logger.error(f"Error searching for {item['artist']} - {item['title']}: {e}")
                with get_db() as db:
                    db.execute(
                        "UPDATE upgrade_queue SET status = 'failed' WHERE id = ?",
                        (item["id"],)
                    )
    finally:
        upgrade_status["running"] = False
        upgrade_status["phase"] = "idle"


def run_downloads():
    """Background task: download FLACs for all approved queue items."""
    staging = Path(os.environ.get("STAGING_PATH", "/staging"))
    trash_dir = Path(os.environ.get("TRASH_PATH", "/trash"))
    music_root = Path(os.environ.get("MUSIC_PATH", "/music"))

    with get_db() as db:
        approved = db.execute("""
            SELECT uq.*, t.file_path, t.artist, t.title, t.album, t.track_number
            FROM upgrade_queue uq
            JOIN tracks t ON uq.track_id = t.id
            WHERE uq.status = 'approved'
              AND uq.squid_url IS NOT NULL
              AND uq.squid_url != 'None'
        """).fetchall()

    upgrade_status["running"] = True
    upgrade_status["phase"] = "downloading"
    upgrade_status["total"] = len(approved)
    upgrade_status["progress"] = 0
    upgrade_status["current"] = ""

    try:
        for i, item in enumerate(approved):
            upgrade_status["progress"] = i + 1
            upgrade_status["current"] = f"{item['artist']} - {item['title']}"

            with get_db() as db:
                db.execute("UPDATE upgrade_queue SET status = 'downloading' WHERE id = ?", (item["id"],))

            try:
                tidal_track_id = int(item["squid_url"])
                # Get download URL (try hi-res first, falls back to lossless)
                dl_info = asyncio.run(get_download_url(tidal_track_id, QUALITY_HI_RES, rate_limit=2.0))

                # Download to staging
                safe_name = f"{item['artist']} - {item['title']}.flac".replace("/", "_")
                staging_path = staging / safe_name
                asyncio.run(download_flac(dl_info["url"], staging_path, rate_limit=1.0))

                # Verify the download by reading its metadata
                new_meta = read_track_metadata(staging_path)
                if new_meta["format"] != "flac" or new_meta["file_size"] < 1000:
                    raise ValueError("Downloaded file is not a valid FLAC")

                # Move FLAC to final location (same dir as original, new extension)
                original_path = Path(item["file_path"])
                flac_dest = original_path.with_suffix(".flac")
                flac_dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(staging_path), str(flac_dest))

                # Move original lossy file to trash (after FLAC is safely in place)
                dest = trash_file(original_path, trash_dir, music_root)

                # Update database
                with get_db() as db:
                    # Mark original as upgraded
                    db.execute("UPDATE tracks SET status = 'upgraded' WHERE id = ?", (item["track_id"],))

                    # Log the file action
                    db.execute(
                        "INSERT INTO file_actions (track_id, action, source_path, dest_path) VALUES (?, 'trash', ?, ?)",
                        (item["track_id"], item["file_path"], dest)
                    )

                    # Insert new FLAC track
                    db.execute("""
                        INSERT INTO tracks (file_path, file_size, format, bitrate, bit_depth,
                            sample_rate, duration, artist, album_artist, album, title,
                            track_number, disc_number, fingerprint, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
                    """, (
                        str(flac_dest), new_meta["file_size"], "flac",
                        new_meta.get("bitrate", 0),
                        dl_info["bit_depth"], dl_info["sample_rate"], new_meta["duration"],
                        new_meta["artist"] or item["artist"],
                        new_meta.get("album_artist", ""),
                        new_meta["album"] or item["album"],
                        new_meta["title"] or item["title"],
                        new_meta["track_number"] or item["track_number"],
                        new_meta.get("disc_number", 1),
                        new_meta.get("fingerprint", ""),
                    ))

                    # Mark queue item complete
                    db.execute(
                        "UPDATE upgrade_queue SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (item["id"],)
                    )

                logger.info(f"Upgraded: {item['artist']} - {item['title']} ({dl_info['bit_depth']}bit/{dl_info['sample_rate']}Hz)")

            except Exception as e:
                logger.error(f"Download failed for {item['artist']} - {item['title']}: {e}")
                with get_db() as db:
                    db.execute("UPDATE upgrade_queue SET status = 'failed' WHERE id = ?", (item["id"],))

                # Clean up staging file if it exists
                staging_path = staging / f"{item['artist']} - {item['title']}.flac".replace("/", "_")
                if staging_path.exists():
                    staging_path.unlink()
    finally:
        upgrade_status["running"] = False
        upgrade_status["phase"] = "idle"
        upgrade_status["current"] = ""
