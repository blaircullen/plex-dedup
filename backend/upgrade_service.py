import httpx
import asyncio
from pathlib import Path
from dedup import normalize_text

def build_search_query(track: dict) -> str:
    """Build a search query for squid.wtf from track metadata."""
    return f"{track['artist']} {track['album']}"

def classify_match(track: dict, result: dict) -> str:
    """Classify how well a squid.wtf result matches our track."""
    t_artist = normalize_text(track.get("artist", ""))
    t_album = normalize_text(track.get("album", ""))
    t_title = normalize_text(track.get("title", ""))

    r_artist = normalize_text(result.get("artist", ""))
    r_album = normalize_text(result.get("album", ""))
    r_title = normalize_text(result.get("title", ""))

    if t_artist == r_artist and t_album == r_album and t_title == r_title:
        return "exact"
    if t_artist == r_artist and (t_album in r_album or r_album in t_album):
        return "fuzzy"
    return "none"

async def search_squid(query: str, rate_limit: float = 3.0) -> list[dict]:
    """Search squid.wtf for tracks.

    NOTE: squid.wtf has no public API. This is a placeholder.
    The actual implementation needs to be adapted based on inspecting
    the site's network requests to find internal API endpoints.
    """
    await asyncio.sleep(rate_limit)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://tidal.squid.wtf/search",
            params={"q": query},
            headers={"User-Agent": "plex-dedup/1.0"},
            timeout=30,
        )
        # Parse response — format TBD based on actual site structure
        return []

async def download_flac(url: str, dest: Path, rate_limit: float = 5.0) -> Path:
    """Download a FLAC file from squid.wtf to the staging directory."""
    await asyncio.sleep(rate_limit)
    async with httpx.AsyncClient() as client:
        async with client.stream("GET", url, timeout=120) as resp:
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, "wb") as f:
                async for chunk in resp.aiter_bytes(8192):
                    f.write(chunk)
    return dest
