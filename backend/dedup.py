import re
import unicodedata
from collections import defaultdict

from scanner import quality_score


def normalize_text(text: str) -> str:
    """Normalize text for comparison."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if text.startswith("the "):
        text = text[4:]
    return text


def group_by_metadata(tracks: list[dict]) -> list[list[dict]]:
    """Group tracks by normalized (artist, title, album). Returns groups with 2+ members."""
    groups: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for track in tracks:
        key = (
            normalize_text(track.get("artist", "")),
            normalize_text(track.get("title", "")),
            normalize_text(track.get("album", "")),
        )
        groups[key].append(track)
    return [members for members in groups.values() if len(members) >= 2]


def find_duplicates(group: list[dict]) -> dict:
    """Given a group of duplicate tracks, pick the best and mark the rest for trash."""
    ranked = sorted(group, key=lambda t: quality_score(t), reverse=True)
    best = ranked[0]
    rest = ranked[1:]
    return {
        "keep_id": best["id"],
        "trash_ids": [t["id"] for t in rest],
        "quality_gap": quality_score(best) - quality_score(rest[0]) if rest else 0,
    }
