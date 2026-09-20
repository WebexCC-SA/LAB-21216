#!/usr/bin/env python3
"""Make the Lab 5 speed-dial list match the configured Smart Audio number."""

from collections import Counter
from pathlib import Path
import shutil

from PIL import Image, ImageDraw, ImageFont


PROJECT_ROOT = Path(__file__).resolve().parent.parent
IMAGE_PATH = PROJECT_ROOT / "docs" / "assets" / "image-54.png"
BACKUP_PATH = IMAGE_PATH.with_name("image-54.backup.png")
FONT_PATH = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
PHONE_NUMBER = "9199912389"
PHONE_NUMBER_BOX = (602, 68, 753, 124)


def main() -> None:
    if not IMAGE_PATH.exists():
        raise FileNotFoundError(f"Screenshot not found: {IMAGE_PATH}")
    if not FONT_PATH.exists():
        raise FileNotFoundError(f"Font not found: {FONT_PATH}")

    if not BACKUP_PATH.exists():
        shutil.copy2(IMAGE_PATH, BACKUP_PATH)

    with Image.open(BACKUP_PATH) as source:
        image = source.convert("RGB")

    pixels = image.crop(PHONE_NUMBER_BOX).get_flattened_data()
    background = Counter(pixels).most_common(1)[0][0]
    draw = ImageDraw.Draw(image)
    draw.rectangle(PHONE_NUMBER_BOX, fill=background)

    font = ImageFont.truetype(str(FONT_PATH), 23)
    text_box = draw.textbbox((0, 0), PHONE_NUMBER, font=font)
    text_width = text_box[2] - text_box[0]
    text_height = text_box[3] - text_box[1]
    x = PHONE_NUMBER_BOX[2] - text_width - 14
    y = PHONE_NUMBER_BOX[1] + (
        PHONE_NUMBER_BOX[3] - PHONE_NUMBER_BOX[1] - text_height
    ) // 2 - text_box[1]
    draw.text((x, y), PHONE_NUMBER, font=font, fill=(207, 207, 207))

    image.save(IMAGE_PATH, optimize=True)
    print(f"Updated {IMAGE_PATH.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
