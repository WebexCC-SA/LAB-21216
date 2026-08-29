#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import mimetypes
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import mammoth
from markdownify import markdownify as html_to_markdown


HEADING_RE = re.compile(r"^(#{1,2})\s+(.*\S)\s*$")
ANY_HEADING_RE = re.compile(r"^#{1,6}\s+")
IMAGE_MARKDOWN_RE = re.compile(r"!\[([^\]]*)\]\(([^)\r\n]+)\)", re.DOTALL)
NON_WORD_RE = re.compile(r"[^a-z0-9]+")
ORDERED_LIST_LINE_RE = re.compile(r"^(\s*)(\d+)\.(\s+)(.*)$")
LIST_LINE_INDENT_RE = re.compile(r"^([ \t]+)(?=(?:\d+\.|[*+-])\s)")
NESTED_ORDERED_LINE_RE = re.compile(
    r"^(\s*)[*+-]\s+(\d+\.\s+)", re.MULTILINE
)
NESTED_UNORDERED_LINE_RE = re.compile(
    r"^(\s*)[*+-]\s+([*+-]\s+)", re.MULTILINE
)
INDENTED_UNORDERED_LINE_RE = re.compile(r"^([ \t]+)([*+-]\s+.*)$")
IMAGE_FILENAME_RE = re.compile(r"^docx-image-(\d{3,})\.[a-z0-9]+$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convert a DOCX into Markdown files under docs/, splitting each "
            "Heading 1/2 that starts with 'Lab' into its own file."
        )
    )
    parser.add_argument("input_docx", help="Path to the source .docx file")
    parser.add_argument(
        "--docs-dir",
        default="docs",
        help="Directory where markdown files should be written (default: docs)",
    )
    parser.add_argument(
        "--assets-dir",
        default=None,
        help="Directory where extracted images should be written (default: <docs-dir>/assets)",
    )
    return parser.parse_args()


def slugify(text: str) -> str:
    lowered = text.strip().lower()
    slug = NON_WORD_RE.sub("-", lowered).strip("-")
    return slug or "lab"


def unique_slug(slug: str, used: Dict[str, int]) -> str:
    if slug not in used:
        used[slug] = 1
        return slug
    used[slug] += 1
    return f"{slug}-{used[slug]}"


def normalize_image_markdown(markdown: str) -> str:
    def replace_image(match: re.Match[str]) -> str:
        alt_text = re.sub(r"\s+", " ", match.group(1)).strip()
        destination = match.group(2).strip()
        return f"![{alt_text}]({destination})"

    return IMAGE_MARKDOWN_RE.sub(replace_image, markdown)


def normalize_list_markdown(markdown: str) -> str:
    # markdownify can flatten an ordered child of an empty bullet to "* 1.".
    # Restore it as an indented ordered item before continuing the numbering.
    markdown = NESTED_ORDERED_LINE_RE.sub(r"\1   \2", markdown)

    counters: Dict[int, int] = {}
    normalized_lines: List[str] = []
    flattened_bullet_prefix: Optional[str] = None
    flattened_bullet_width: Optional[int] = None
    for line in markdown.splitlines():
        nested_unordered = NESTED_UNORDERED_LINE_RE.match(line)
        if nested_unordered:
            flattened_bullet_prefix = nested_unordered.group(1)
            flattened_bullet_width = (
                len(flattened_bullet_prefix.expandtabs(4)) + 2
            )
            line = (
                flattened_bullet_prefix
                + nested_unordered.group(2)
                + line[nested_unordered.end() :]
            )
        elif flattened_bullet_width is not None:
            indented_unordered = INDENTED_UNORDERED_LINE_RE.match(line)
            if (
                indented_unordered
                and len(indented_unordered.group(1).expandtabs(4))
                == flattened_bullet_width
            ):
                line = (
                    (flattened_bullet_prefix or "")
                    + indented_unordered.group(2)
                )
            elif line.strip():
                flattened_bullet_prefix = None
                flattened_bullet_width = None

        indent_match = LIST_LINE_INDENT_RE.match(line)
        if indent_match:
            current_width = len(indent_match.group(1).expandtabs(4))
            if current_width % 4:
                nesting_level = max(1, (current_width + 1) // 3)
                line = (
                    " " * (nesting_level * 4)
                    + line[indent_match.end() :]
                )

        if ANY_HEADING_RE.match(line):
            counters.clear()

        match = ORDERED_LIST_LINE_RE.match(line)
        if not match:
            normalized_lines.append(line)
            continue

        indentation = match.group(1)
        level = len(indentation.expandtabs(4)) // 4
        for deeper_level in [item for item in counters if item > level]:
            del counters[deeper_level]
        counters[level] = counters.get(level, int(match.group(2)) - 1) + 1
        normalized_lines.append(
            f"{indentation}{counters[level]}.{match.group(3)}{match.group(4)}"
        )

    return "\n".join(normalized_lines)


def file_digest(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def existing_image_digests(assets_dir: Path) -> Tuple[Dict[str, str], int]:
    digests: Dict[str, str] = {}
    highest_number = 0
    for file_path in sorted(assets_dir.iterdir()):
        if not file_path.is_file():
            continue
        digests.setdefault(file_digest(file_path), file_path.name)
        match = IMAGE_FILENAME_RE.match(file_path.name.lower())
        if match:
            highest_number = max(highest_number, int(match.group(1)))
    return digests, highest_number


def build_image_converter(assets_dir: Path, assets_rel_from_docs: str):
    existing_digests, highest_number = existing_image_digests(assets_dir)
    counter = {"value": highest_number}

    def convert_image(image: mammoth.images.Image):
        ext = mimetypes.guess_extension(image.content_type or "") or ".bin"
        with image.open() as image_bytes:
            content = image_bytes.read()
        digest = hashlib.sha256(content).hexdigest()
        filename = existing_digests.get(digest)
        if filename is None:
            counter["value"] += 1
            filename = f"docx-image-{counter['value']:03d}{ext}"
            (assets_dir / filename).write_bytes(content)
            existing_digests[digest] = filename
        src = f"{assets_rel_from_docs}/{filename}".replace("\\", "/")
        return {"src": src}

    return mammoth.images.img_element(convert_image)


def convert_docx_to_markdown(
    input_docx: Path, assets_dir: Path, assets_rel_from_docs: str
) -> Tuple[str, List[str]]:
    with input_docx.open("rb") as docx_file:
        result = mammoth.convert_to_html(
            docx_file, convert_image=build_image_converter(assets_dir, assets_rel_from_docs)
        )
    markdown = html_to_markdown(result.value, heading_style="ATX")
    markdown = markdown.replace("\r\n", "\n").replace("\r", "\n")
    markdown = normalize_image_markdown(markdown)
    markdown = normalize_list_markdown(markdown)
    return markdown, [msg.message for msg in result.messages]


def split_markdown_into_sections(markdown: str) -> Tuple[List[Tuple[str, str]], str]:
    lines = markdown.split("\n")
    headings: List[Tuple[int, str]] = []
    for idx, line in enumerate(lines):
        match = HEADING_RE.match(line)
        if match:
            headings.append((idx, match.group(2).strip()))

    labs: List[Tuple[str, str]] = []
    non_lab_chunks: List[str] = []

    if not headings:
        non_lab = "\n".join(lines).strip()
        return labs, non_lab

    preface = "\n".join(lines[: headings[0][0]]).strip()
    if preface:
        non_lab_chunks.append(preface)

    for i, (start, title) in enumerate(headings):
        end = headings[i + 1][0] if i + 1 < len(headings) else len(lines)
        chunk = "\n".join(lines[start:end]).strip()
        if not chunk:
            continue
        if title.lower().startswith("lab"):
            labs.append((title, chunk))
        else:
            non_lab_chunks.append(chunk)

    non_lab = "\n\n".join(part for part in non_lab_chunks if part).strip()
    return labs, non_lab


def archive_existing_output(file_path: Path, timestamp: str) -> Optional[Path]:
    if not file_path.exists():
        return None

    archived_path = file_path.with_name(
        f"{file_path.stem}-{timestamp}{file_path.suffix}"
    )
    suffix = 2
    while archived_path.exists():
        archived_path = file_path.with_name(
            f"{file_path.stem}-{timestamp}-{suffix}{file_path.suffix}"
        )
        suffix += 1
    file_path.rename(archived_path)
    return archived_path


def write_outputs(
    docs_dir: Path, labs: List[Tuple[str, str]], non_lab: str
) -> Tuple[List[Path], List[Path]]:
    written_files: List[Path] = []
    archived_files: List[Path] = []
    used_slugs: Dict[str, int] = {}
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    for title, content in labs:
        file_slug = unique_slug(slugify(title), used_slugs)
        file_path = docs_dir / f"{file_slug}.md"
        archived_path = archive_existing_output(file_path, timestamp)
        if archived_path:
            archived_files.append(archived_path)
        file_path.write_text(content + "\n", encoding="utf-8")
        written_files.append(file_path)

    if non_lab:
        non_lab_path = docs_dir / "non-lab.md"
        archived_path = archive_existing_output(non_lab_path, timestamp)
        if archived_path:
            archived_files.append(archived_path)
        non_lab_path.write_text(non_lab + "\n", encoding="utf-8")
        written_files.append(non_lab_path)

    return written_files, archived_files


def main() -> None:
    args = parse_args()
    input_docx = Path(args.input_docx).resolve()
    docs_dir = Path(args.docs_dir).resolve()
    assets_dir = Path(args.assets_dir).resolve() if args.assets_dir else (docs_dir / "assets").resolve()

    if not input_docx.exists():
        raise FileNotFoundError(f"Input DOCX not found: {input_docx}")
    if input_docx.suffix.lower() != ".docx":
        raise ValueError(f"Input file must be a .docx file: {input_docx}")

    docs_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    assets_rel_str = os.path.relpath(assets_dir, docs_dir).replace("\\", "/")

    markdown, conversion_messages = convert_docx_to_markdown(input_docx, assets_dir, assets_rel_str)
    labs, non_lab = split_markdown_into_sections(markdown)
    written_files, archived_files = write_outputs(docs_dir, labs, non_lab)

    if not labs:
        print("No lab headings (Heading 1/2 starting with 'Lab') were found. Wrote only non-lab content.")

    for message in conversion_messages:
        print(f"[mammoth] {message}")

    for archived_file in archived_files:
        print(f"Archived existing Markdown: {archived_file}")
    print(f"Wrote {len(written_files)} markdown file(s) to: {docs_dir}")
    print(f"Extracted images to: {assets_dir}")


if __name__ == "__main__":
    main()
