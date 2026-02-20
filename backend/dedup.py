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


def compute_confidence(group: list[dict]) -> float:
    """Compute confidence (0-1) that tracks in a group are true duplicates.

    Based on duration similarity — if all tracks have similar duration,
    they're very likely the same recording. Metadata already matched to form the group.
    """
    durations = [t.get("duration", 0) for t in group if t.get("duration", 0) > 0]
    if len(durations) < 2:
        return 0.5  # No duration data, moderate confidence from metadata match alone

    avg = sum(durations) / len(durations)
    if avg == 0:
        return 0.5

    max_deviation = max(abs(d - avg) / avg for d in durations)

    if max_deviation < 0.02:      # Within 2% — almost certainly same recording
        return 0.95
    elif max_deviation < 0.05:    # Within 5% — very likely
        return 0.85
    elif max_deviation < 0.10:    # Within 10% — probably (could be different edits)
        return 0.70
    elif max_deviation < 0.20:    # Within 20% — possible but uncertain
        return 0.50
    else:                          # >20% difference — likely different tracks
        return 0.30


def find_duplicates(group: list[dict]) -> dict:
    """Given a group of duplicate tracks, pick the best and mark the rest for trash."""
    ranked = sorted(group, key=lambda t: quality_score(t), reverse=True)
    best = ranked[0]
    rest = ranked[1:]
    return {
        "keep_id": best["id"],
        "trash_ids": [t["id"] for t in rest],
        "quality_gap": quality_score(best) - quality_score(rest[0]) if rest else 0,
        "confidence": compute_confidence(group),
    }
