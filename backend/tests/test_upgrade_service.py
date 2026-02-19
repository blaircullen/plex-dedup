import pytest
from upgrade_service import build_search_query, classify_match

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
