import json
import os
import subprocess
from pathlib import Path
from typing import Generator
from mutagen import File as MutagenFile
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
from mutagen.mp4 import MP4
from mutagen.oggvorbis import OggVorbis

AUDIO_EXTENSIONS = {".mp3", ".flac", ".m4a", ".ogg", ".opus", ".wma", ".aac", ".wav"}
LOSSLESS_FORMATS = {"flac", "wav", "alac"}


def read_track_metadata(file_path: Path) -> dict:
    """Read audio metadata from a file using mutagen."""
    file_path = Path(file_path)
    ext = file_path.suffix.lower()
    stat = file_path.stat()

    meta = {
        "file_path": str(file_path),
        "file_size": stat.st_size,
        "format": ext.lstrip("."),
        "bitrate": 0,
        "bit_depth": 0,
        "sample_rate": 0,
        "duration": 0.0,
        "artist": "",
        "album_artist": "",
        "album": "",
        "title": "",
        "track_number": 0,
        "disc_number": 0,
    }

    audio = MutagenFile(file_path)
    if audio is None:
        return meta

    meta["duration"] = audio.info.length if hasattr(audio.info, "length") else 0.0
    meta["sample_rate"] = getattr(audio.info, "sample_rate", 0)
    meta["bitrate"] = (
        int(getattr(audio.info, "bitrate", 0) / 1000)
        if hasattr(audio.info, "bitrate")
        else 0
    )

    if isinstance(audio, FLAC):
        meta["format"] = "flac"
        meta["bit_depth"] = audio.info.bits_per_sample
        meta["artist"] = _first(audio.get("artist"))
        meta["album_artist"] = _first(audio.get("albumartist", audio.get("artist")))
        meta["album"] = _first(audio.get("album"))
        meta["title"] = _first(audio.get("title"))
        meta["track_number"] = _parse_int(_first(audio.get("tracknumber")))
        meta["disc_number"] = _parse_int(_first(audio.get("discnumber")))
    elif isinstance(audio, MP3):
        meta["format"] = "mp3"
        if audio.tags:
            meta["artist"] = str(audio.tags.get("TPE1", ""))
            meta["album_artist"] = str(
                audio.tags.get("TPE2", audio.tags.get("TPE1", ""))
            )
            meta["album"] = str(audio.tags.get("TALB", ""))
            meta["title"] = str(audio.tags.get("TIT2", ""))
            meta["track_number"] = _parse_int(str(audio.tags.get("TRCK", "0")))
            meta["disc_number"] = _parse_int(str(audio.tags.get("TPOS", "0")))
    elif isinstance(audio, OggVorbis):
        meta["format"] = "ogg"
        meta["artist"] = _first(audio.get("artist"))
        meta["album"] = _first(audio.get("album"))
        meta["title"] = _first(audio.get("title"))
        meta["track_number"] = _parse_int(_first(audio.get("tracknumber")))
        meta["disc_number"] = _parse_int(_first(audio.get("discnumber")))
    elif isinstance(audio, MP4):
        meta["format"] = "m4a"
        meta["bit_depth"] = getattr(audio.info, "bits_per_sample", 0)
        meta["artist"] = _first(audio.get("\xa9ART"))
        meta["album"] = _first(audio.get("\xa9alb"))
        meta["title"] = _first(audio.get("\xa9nam"))
        trck = audio.get("trkn")
        if trck:
            meta["track_number"] = trck[0][0]
            meta["disc_number"] = audio.get("disk", [(0,)])[0][0]

    return meta


def quality_score(meta: dict) -> int:
    """Return a numeric quality score. Higher = better."""
    score = 0
    fmt = meta.get("format", "").lower()

    if fmt in LOSSLESS_FORMATS:
        score += 10000

    bit_depth = meta.get("bit_depth", 0)
    score += bit_depth * 100

    sample_rate = meta.get("sample_rate", 0)
    score += sample_rate // 100

    bitrate = meta.get("bitrate", 0)
    score += bitrate

    return score


def generate_fingerprint(file_path: Path) -> str:
    """Generate Chromaprint fingerprint using fpcalc CLI."""
    file_path = Path(file_path)
    try:
        result = subprocess.run(
            ["fpcalc", "-json", str(file_path)],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            return ""
        data = json.loads(result.stdout)
        return data.get("fingerprint", "")
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
        return ""


def scan_directory(root: Path) -> Generator[dict, None, None]:
    """Walk directory tree and yield metadata for each audio file."""
    root = Path(root)
    for dirpath, _, filenames in os.walk(root):
        for filename in sorted(filenames):
            filepath = Path(dirpath) / filename
            if filepath.suffix.lower() in AUDIO_EXTENSIONS:
                try:
                    yield read_track_metadata(filepath)
                except Exception:
                    continue


def _first(val) -> str:
    if val is None:
        return ""
    if isinstance(val, list):
        return str(val[0]) if val else ""
    return str(val)


def _parse_int(val: str) -> int:
    try:
        return int(val.split("/")[0])
    except (ValueError, IndexError):
        return 0
