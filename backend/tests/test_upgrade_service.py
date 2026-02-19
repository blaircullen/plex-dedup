import pytest
from upgrade_service import (
    build_search_query, classify_match,
    _extract_artist_name, _parse_album_result, _parse_track_result,
)


def test_build_search_query():
    track = {"artist": "Radiohead", "album": "OK Computer", "title": "Paranoid Android"}
    assert build_search_query(track) == "Radiohead OK Computer"


def test_classify_exact_match():
    track = {"artist": "Radiohead", "album": "OK Computer", "title": "Paranoid Android"}
    result = {"artist": "Radiohead", "album": "OK Computer", "title": "Paranoid Android"}
    assert classify_match(track, result) == "exact"


def test_classify_fuzzy_match():
    track = {"artist": "Radiohead", "album": "OK Computer", "title": "Paranoid Android"}
    result = {"artist": "Radiohead", "album": "OK Computer (Remaster)", "title": "Paranoid Android"}
    assert classify_match(track, result) == "fuzzy"


def test_classify_no_match():
    track = {"artist": "Radiohead", "album": "OK Computer", "title": "Paranoid Android"}
    result = {"artist": "Coldplay", "album": "Parachutes", "title": "Yellow"}
    assert classify_match(track, result) == "none"


def test_extract_artist_name_dict():
    assert _extract_artist_name({"name": "Radiohead", "id": 64518}) == "Radiohead"


def test_extract_artist_name_list():
    assert _extract_artist_name([{"name": "Radiohead"}, {"name": "Other"}]) == "Radiohead"


def test_extract_artist_name_empty():
    assert _extract_artist_name(None) == ""
    assert _extract_artist_name([]) == ""


def test_parse_album_result():
    raw = {
        "id": 58990510,
        "title": "OK Computer",
        "artists": [{"name": "Radiohead", "id": 64518}],
        "numberOfTracks": 12,
        "releaseDate": "1997-06-16",
        "audioQuality": "LOSSLESS",
        "cover": "abc123",
    }
    parsed = _parse_album_result(raw)
    assert parsed["tidal_id"] == 58990510
    assert parsed["title"] == "OK Computer"
    assert parsed["artist"] == "Radiohead"
    assert parsed["num_tracks"] == 12
    assert parsed["audio_quality"] == "LOSSLESS"


def test_parse_track_result():
    raw = {
        "id": 58990511,
        "title": "Airbag",
        "artists": [{"name": "Radiohead"}],
        "album": {"title": "OK Computer", "id": 58990510},
        "trackNumber": 1,
        "volumeNumber": 1,
        "duration": 287,
        "audioQuality": "LOSSLESS",
        "isrc": "GBAYE9700102",
    }
    parsed = _parse_track_result(raw)
    assert parsed["tidal_id"] == 58990511
    assert parsed["title"] == "Airbag"
    assert parsed["artist"] == "Radiohead"
    assert parsed["album"] == "OK Computer"
    assert parsed["track_number"] == 1
    assert parsed["duration"] == 287


def test_parse_track_result_with_artist_dict():
    """Handle case where artist is a dict instead of a list."""
    raw = {
        "id": 123,
        "title": "Song",
        "artist": {"name": "Solo Artist"},
        "album": {"title": "Album"},
        "trackNumber": 1,
        "duration": 200,
    }
    parsed = _parse_track_result(raw)
    assert parsed["artist"] == "Solo Artist"
