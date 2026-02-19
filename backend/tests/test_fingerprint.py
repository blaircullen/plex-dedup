import pytest
from pathlib import Path
from scanner import generate_fingerprint

FIXTURES = Path(__file__).parent / "fixtures"

def test_fingerprint_returns_string():
    fp = generate_fingerprint(FIXTURES / "test_128.mp3")
    assert isinstance(fp, str)
    assert len(fp) > 0

def test_same_file_same_fingerprint():
    fp1 = generate_fingerprint(FIXTURES / "test_128.mp3")
    fp2 = generate_fingerprint(FIXTURES / "test_128.mp3")
    assert fp1 == fp2

def test_different_files_produce_fingerprints():
    fp1 = generate_fingerprint(FIXTURES / "test_128.mp3")
    fp2 = generate_fingerprint(FIXTURES / "test_16_44.flac")
    assert isinstance(fp1, str)
    assert isinstance(fp2, str)
