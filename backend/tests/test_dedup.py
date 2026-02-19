import pytest
from dedup import normalize_text, group_by_metadata, find_duplicates


def test_normalize_text_lowercase():
    assert normalize_text("Hello World") == "hello world"


def test_normalize_text_strips_the_prefix():
    assert normalize_text("The Beatles") == "beatles"
    assert normalize_text("The Rolling Stones") == "rolling stones"


def test_normalize_text_strips_punctuation():
    assert normalize_text("Don't Stop Me Now!") == "dont stop me now"


def test_normalize_text_collapses_whitespace():
    assert normalize_text("  hello   world  ") == "hello world"


def test_group_by_metadata_finds_dupes():
    tracks = [
        {"id": 1, "artist": "Beatles", "title": "Help", "album": "Help!", "format": "mp3", "bitrate": 128, "bit_depth": 0, "sample_rate": 44100},
        {"id": 2, "artist": "The Beatles", "title": "Help!", "album": "Help!", "format": "flac", "bitrate": 0, "bit_depth": 16, "sample_rate": 44100},
        {"id": 3, "artist": "Led Zeppelin", "title": "Stairway", "album": "IV", "format": "flac", "bitrate": 0, "bit_depth": 16, "sample_rate": 44100},
    ]
    groups = group_by_metadata(tracks)
    assert len(groups) == 1
    assert len(groups[0]) == 2


def test_group_by_metadata_different_albums_not_duped():
    tracks = [
        {"id": 1, "artist": "Beatles", "title": "Help", "album": "Help!", "format": "mp3", "bitrate": 128, "bit_depth": 0, "sample_rate": 44100},
        {"id": 2, "artist": "Beatles", "title": "Help", "album": "Greatest Hits", "format": "flac", "bitrate": 0, "bit_depth": 16, "sample_rate": 44100},
    ]
    groups = group_by_metadata(tracks)
    assert len(groups) == 0


def test_find_duplicates_picks_best_quality():
    group = [
        {"id": 1, "format": "mp3", "bitrate": 128, "bit_depth": 0, "sample_rate": 44100},
        {"id": 2, "format": "flac", "bitrate": 0, "bit_depth": 16, "sample_rate": 44100},
    ]
    result = find_duplicates(group)
    assert result["keep_id"] == 2
    assert result["trash_ids"] == [1]
