import pytest
from pathlib import Path
from scanner import read_track_metadata, scan_directory, quality_score

FIXTURES = Path(__file__).parent / "fixtures"


def test_read_mp3_metadata():
    meta = read_track_metadata(FIXTURES / "test_128.mp3")
    assert meta["format"] == "mp3"
    assert meta["artist"] == "Test Artist"
    assert meta["title"] == "Test Song"
    assert meta["album"] == "Test Album"
    assert meta["bitrate"] > 0
    assert meta["sample_rate"] == 44100


def test_read_flac_metadata():
    meta = read_track_metadata(FIXTURES / "test_16_44.flac")
    assert meta["format"] == "flac"
    assert meta["bit_depth"] == 16
    assert meta["sample_rate"] == 44100


def test_read_hires_flac_metadata():
    meta = read_track_metadata(FIXTURES / "test_24_96.flac")
    assert meta["format"] == "flac"
    assert meta["bit_depth"] == 24
    assert meta["sample_rate"] == 96000


def test_quality_score_flac_beats_mp3():
    flac = {"format": "flac", "bit_depth": 16, "sample_rate": 44100, "bitrate": 0}
    mp3 = {"format": "mp3", "bit_depth": 0, "sample_rate": 44100, "bitrate": 320}
    assert quality_score(flac) > quality_score(mp3)


def test_quality_score_hires_beats_cd():
    hires = {"format": "flac", "bit_depth": 24, "sample_rate": 96000, "bitrate": 0}
    cd = {"format": "flac", "bit_depth": 16, "sample_rate": 44100, "bitrate": 0}
    assert quality_score(hires) > quality_score(cd)


def test_quality_score_320_beats_128():
    high = {"format": "mp3", "bit_depth": 0, "sample_rate": 44100, "bitrate": 320}
    low = {"format": "mp3", "bit_depth": 0, "sample_rate": 44100, "bitrate": 128}
    assert quality_score(high) > quality_score(low)


def test_scan_directory_finds_all_files():
    results = list(scan_directory(FIXTURES))
    assert len(results) == 4  # 2 mp3 + 2 flac
