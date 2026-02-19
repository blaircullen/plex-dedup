import shutil
from pathlib import Path


def trash_file(file_path: Path, trash_dir: Path, music_root: Path = None) -> str:
    """Move a file to the trash directory, preserving relative path structure."""
    file_path = Path(file_path)
    trash_dir = Path(trash_dir)

    if music_root:
        rel_path = file_path.relative_to(music_root)
    else:
        rel_path = Path(file_path.name)

    dest = trash_dir / rel_path
    dest.parent.mkdir(parents=True, exist_ok=True)

    if dest.exists():
        stem = dest.stem
        suffix = dest.suffix
        counter = 1
        while dest.exists():
            dest = dest.parent / f"{stem}_{counter}{suffix}"
            counter += 1

    shutil.move(str(file_path), str(dest))
    return str(dest)


def restore_file(trash_path: str, original_path: str) -> None:
    """Restore a file from trash to its original location."""
    trash_path = Path(trash_path)
    original = Path(original_path)
    original.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(trash_path), str(original))


def get_trash_size(trash_dir: Path) -> int:
    """Return total size in bytes of all files in trash."""
    trash_dir = Path(trash_dir)
    if not trash_dir.exists():
        return 0
    return sum(f.stat().st_size for f in trash_dir.rglob("*") if f.is_file())


def empty_trash(trash_dir: Path) -> int:
    """Delete all files in trash. Returns number of files deleted."""
    trash_dir = Path(trash_dir)
    count = 0
    if trash_dir.exists():
        for f in trash_dir.rglob("*"):
            if f.is_file():
                f.unlink()
                count += 1
        for d in sorted(trash_dir.rglob("*"), reverse=True):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()
    return count
