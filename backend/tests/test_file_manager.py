import pytest
from pathlib import Path
import tempfile
import shutil
from file_manager import trash_file, restore_file, get_trash_size


@pytest.fixture
def temp_dirs():
    music_dir = Path(tempfile.mkdtemp())
    trash_dir = Path(tempfile.mkdtemp())
    test_file = music_dir / "artist" / "album" / "song.mp3"
    test_file.parent.mkdir(parents=True)
    test_file.write_bytes(b"fake audio data " * 100)
    yield music_dir, trash_dir, test_file
    shutil.rmtree(music_dir, ignore_errors=True)
    shutil.rmtree(trash_dir, ignore_errors=True)


def test_trash_file_moves_to_trash(temp_dirs):
    music_dir, trash_dir, test_file = temp_dirs
    dest = trash_file(test_file, trash_dir)
    assert not test_file.exists()
    assert Path(dest).exists()


def test_trash_file_preserves_relative_path(temp_dirs):
    music_dir, trash_dir, test_file = temp_dirs
    dest = trash_file(test_file, trash_dir, music_root=music_dir)
    assert "artist/album/song.mp3" in dest


def test_restore_file(temp_dirs):
    music_dir, trash_dir, test_file = temp_dirs
    original_path = str(test_file)
    dest = trash_file(test_file, trash_dir, music_root=music_dir)
    restore_file(dest, original_path)
    assert Path(original_path).exists()
    assert not Path(dest).exists()


def test_get_trash_size(temp_dirs):
    music_dir, trash_dir, test_file = temp_dirs
    trash_file(test_file, trash_dir)
    size = get_trash_size(trash_dir)
    assert size > 0
