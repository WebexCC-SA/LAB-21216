#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DOCS_ROOT = PROJECT_ROOT / "docs"
MKDOCS_CONFIG = PROJECT_ROOT / "mkdocs.yml"
MKDOCS_BACKUP = PROJECT_ROOT / "mkdocs.yml.backup.yml"

RENAMES = {
    "lab-user-added-speed-dials.md": "lab-5-user-added-speed-dials.md",
    "lab-7-pagination-on-cisco-desk-phone-9851-and-9861.md": (
        "lab-6-pagination-on-cisco-desk-phone-9851-and-9861.md"
    ),
    "lab-5-customize-the-settings-menu.md": (
        "lab-7-customize-the-settings-menu.md"
    ),
    "lab-6-custom-wallpaper-on-cisco-9800-series-phones.md": (
        "lab-8-custom-wallpaper-on-cisco-9800-series-phones.md"
    ),
    "lab-custom-ringtone.md": "lab-9-custom-ringtone.md",
    "lab-8-smart-audio-in-webex-calling.md": (
        "lab-10-smart-audio-in-webex-calling.md"
    ),
    "lab-9-closed-captions.md": "lab-11-closed-captions.md",
    "lab-control-hub-statuses.md": "lab-12-control-hub-statuses.md",
}


def updated_config() -> tuple[str, bool]:
    config = MKDOCS_CONFIG.read_text(encoding="utf-8")
    updated = config
    for old_name, new_name in RENAMES.items():
        if old_name in updated:
            updated = updated.replace(old_name, new_name)
        elif new_name not in updated:
            raise ValueError(
                f"Neither {old_name} nor {new_name} is referenced by mkdocs.yml."
            )
    return updated, updated != config


def validate_paths() -> None:
    for old_name, new_name in RENAMES.items():
        old_path = DOCS_ROOT / old_name
        new_path = DOCS_ROOT / new_name
        if old_path.exists() and new_path.exists():
            raise FileExistsError(
                f"Both the old and new lab files exist: {old_name}, {new_name}"
            )
        if not old_path.exists() and not new_path.exists():
            raise FileNotFoundError(f"Lab file not found: {old_name}")


def main() -> None:
    validate_paths()
    config, config_changed = updated_config()

    if config_changed and not MKDOCS_BACKUP.exists():
        shutil.copy2(MKDOCS_CONFIG, MKDOCS_BACKUP)

    completed: list[tuple[Path, Path]] = []
    try:
        for old_name, new_name in RENAMES.items():
            old_path = DOCS_ROOT / old_name
            new_path = DOCS_ROOT / new_name
            if old_path.exists():
                old_path.rename(new_path)
                completed.append((new_path, old_path))

        if config_changed:
            temporary_config = PROJECT_ROOT / "mkdocs.yml.renumbering"
            temporary_config.write_text(config, encoding="utf-8")
            os.replace(temporary_config, MKDOCS_CONFIG)
    except Exception:
        for current_path, original_path in reversed(completed):
            if current_path.exists() and not original_path.exists():
                current_path.rename(original_path)
        raise

    renamed_count = len(completed)
    print(
        f"Lab filenames are synchronized; renamed {renamed_count} file"
        f"{'' if renamed_count == 1 else 's'}."
    )


if __name__ == "__main__":
    main()
