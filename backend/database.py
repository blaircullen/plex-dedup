import sqlite3
from pathlib import Path
from contextlib import contextmanager
import os

DB_PATH = Path(os.environ.get("DB_PATH", "plex-dedup.db"))

def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                file_size INTEGER,
                format TEXT,
                bitrate INTEGER,
                bit_depth INTEGER,
                sample_rate INTEGER,
                duration REAL,
                artist TEXT,
                album_artist TEXT,
                album TEXT,
                title TEXT,
                track_number INTEGER,
                disc_number INTEGER,
                fingerprint TEXT,
                scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active'
            );

            CREATE TABLE IF NOT EXISTS dupe_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                match_type TEXT,
                confidence REAL,
                resolved INTEGER DEFAULT 0,
                kept_track_id INTEGER REFERENCES tracks(id)
            );

            CREATE TABLE IF NOT EXISTS dupe_group_members (
                group_id INTEGER REFERENCES dupe_groups(id),
                track_id INTEGER REFERENCES tracks(id),
                PRIMARY KEY (group_id, track_id)
            );

            CREATE TABLE IF NOT EXISTS upgrade_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id INTEGER REFERENCES tracks(id),
                search_query TEXT,
                match_type TEXT,
                squid_url TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS file_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id INTEGER REFERENCES tracks(id),
                action TEXT,
                source_path TEXT,
                dest_path TEXT,
                performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_tracks_artist_title ON tracks(artist, title);
            CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status);
            CREATE INDEX IF NOT EXISTS idx_tracks_format ON tracks(format);
            CREATE INDEX IF NOT EXISTS idx_upgrade_queue_status ON upgrade_queue(status);
        """)

@contextmanager
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
