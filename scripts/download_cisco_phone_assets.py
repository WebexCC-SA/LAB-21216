#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set, Tuple
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from defusedxml import ElementTree as SafeElementTree


PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "docs" / "lab-assets" / "cisco-phone-services"
BACKUP_ROOT = PROJECT_ROOT / "_cisco_phone_assets_backups"
SOURCE_ROOT = (
    "https://www.cisco.com/c/dam/en/us/td/docs/"
    "voice_ip_comm/phv/dxml/"
)
DEFAULT_PUBLIC_BASE_URL = (
    "https://webexcc-sa.github.io/LAB-21216/"
    "lab-assets/cisco-phone-services/"
)
ENTRY_POINTS = ("menu.xml", "tornado.xml")
INPUT_FORM_NAME = "CiscoIPPhoneInput.xml"
MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024
MAX_XML_DEPTH = 32
MAX_XML_ELEMENTS = 2000
ALLOWED_SUFFIXES = {".xml", ".png"}
SAFE_FILENAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Download Cisco phone XML examples and their static dependencies."
        )
    )
    parser.add_argument(
        "--public-base-url",
        default=DEFAULT_PUBLIC_BASE_URL,
        help="Public URL prefix written into hosted XML references.",
    )
    return parser.parse_args()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def validate_xml_structure(root: ElementTree.Element) -> None:
    element_count = 0
    pending = [(root, 1)]
    while pending:
        element, depth = pending.pop()
        element_count += 1
        if element_count > MAX_XML_ELEMENTS:
            raise ValueError("XML document exceeds the element limit.")
        if depth > MAX_XML_DEPTH:
            raise ValueError("XML document exceeds the nesting limit.")
        pending.extend((child, depth + 1) for child in element)


def source_url(filename: str) -> str:
    return urljoin(SOURCE_ROOT, filename)


def validated_filename(url: str) -> str:
    parsed = urlsplit(url)
    source = urlsplit(SOURCE_ROOT)
    if (
        parsed.scheme != "https"
        or parsed.hostname != source.hostname
        or not parsed.path.startswith(source.path)
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError(f"Referenced URL is outside the approved source: {url}")
    filename = unquote(Path(parsed.path).name)
    if (
        not SAFE_FILENAME_RE.fullmatch(filename)
        or Path(filename).suffix.lower() not in ALLOWED_SUFFIXES
    ):
        raise ValueError(f"Referenced asset filename is not allowed: {url}")
    return filename


def download(url: str) -> Tuple[bytes, str]:
    validated_filename(url)
    request = Request(
        url,
        headers={
            "Accept": "application/xml,text/xml,image/png;q=0.9,*/*;q=0.1",
            "User-Agent": "LAB-21216-asset-downloader/1.0",
        },
    )
    with urlopen(request, timeout=20) as response:
        final_url = response.geturl()
        validated_filename(final_url)
        if validated_filename(final_url) != validated_filename(url):
            raise ValueError(f"Download redirected to a different asset: {url}")
        content = response.read(MAX_DOWNLOAD_BYTES + 1)
        content_type = response.headers.get_content_type()
    if len(content) > MAX_DOWNLOAD_BYTES:
        raise ValueError(f"Downloaded asset exceeds the size limit: {url}")
    return content, content_type


def remove_input_menu_item(root: ElementTree.Element) -> bool:
    removed = False
    for item in list(root):
        if local_name(item.tag) != "MenuItem":
            continue
        name = next(
            (
                child
                for child in item
                if local_name(child.tag) == "Name"
            ),
            None,
        )
        url = next(
            (
                child
                for child in item
                if local_name(child.tag) == "URL"
            ),
            None,
        )
        if (
            name is not None
            and (name.text or "").strip().lower() == "input"
            and url is not None
            and (url.text or "").strip().endswith(INPUT_FORM_NAME)
        ):
            root.remove(item)
            removed = True
    return removed


def transform_xml(
    filename: str, content: bytes, public_base_url: str
) -> Tuple[bytes, Set[str], bool]:
    root = SafeElementTree.fromstring(content)
    validate_xml_structure(root)
    input_removed = False
    if filename == "menu.xml":
        input_removed = remove_input_menu_item(root)
        if not input_removed:
            raise ValueError("The unsupported Input menu item was not found.")

    references: Set[str] = set()
    for element in root.iter():
        if local_name(element.tag) != "URL" or not element.text:
            continue
        value = element.text.strip()
        if value.lower().startswith("softkey:"):
            continue
        if value.startswith(("http://", "https://")):
            referenced_filename = validated_filename(value)
            references.add(referenced_filename)
            element.text = urljoin(public_base_url, referenced_filename)

    ElementTree.indent(root, space="  ")
    return (
        ElementTree.tostring(
            root,
            encoding="utf-8",
            xml_declaration=True,
            short_empty_elements=True,
        )
        + b"\n",
        references,
        input_removed,
    )


def validate_png(filename: str, content: bytes, content_type: str) -> None:
    if content_type != "image/png":
        raise ValueError(
            f"{filename} returned unexpected content type {content_type}."
        )
    if not content.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError(f"{filename} is not a valid PNG file.")


def collect_assets(
    public_base_url: str,
) -> Tuple[Dict[str, bytes], List[Dict[str, object]], bool]:
    pending = list(ENTRY_POINTS)
    outputs: Dict[str, bytes] = {}
    manifest_entries: List[Dict[str, object]] = []
    input_removed = False

    while pending:
        filename = pending.pop(0)
        if filename in outputs:
            continue
        url = source_url(filename)
        source_content, content_type = download(url)
        suffix = Path(filename).suffix.lower()

        if suffix == ".xml":
            if "xml" not in content_type and content_type != "text/plain":
                raise ValueError(
                    f"{filename} returned unexpected content type "
                    f"{content_type}."
                )
            hosted_content, references, removed = transform_xml(
                filename, source_content, public_base_url
            )
            input_removed = input_removed or removed
            pending.extend(sorted(references - outputs.keys()))
        else:
            validate_png(filename, source_content, content_type)
            hosted_content = source_content

        outputs[filename] = hosted_content
        manifest_entries.append(
            {
                "filename": filename,
                "sourceUrl": url,
                "contentType": content_type,
                "sourceBytes": len(source_content),
                "hostedBytes": len(hosted_content),
                "sourceSha256": sha256(source_content),
                "hostedSha256": sha256(hosted_content),
            }
        )

    if not input_removed:
        raise ValueError("The unsupported Input form reference was not removed.")
    return outputs, sorted(
        manifest_entries, key=lambda item: str(item["filename"]).lower()
    ), input_removed


def validate_hosted_references(
    outputs: Dict[str, bytes], public_base_url: str
) -> None:
    for filename, content in outputs.items():
        if Path(filename).suffix.lower() != ".xml":
            continue
        root = SafeElementTree.fromstring(content)
        validate_xml_structure(root)
        for element in root.iter():
            if local_name(element.tag) != "URL" or not element.text:
                continue
            value = element.text.strip()
            if value.lower().startswith("softkey:"):
                continue
            if not value.startswith(public_base_url):
                raise ValueError(
                    f"{filename} contains an unhosted URL reference: {value}"
                )
            referenced_filename = Path(urlsplit(value).path).name
            if referenced_filename not in outputs:
                raise ValueError(
                    f"{filename} references a missing hosted asset: "
                    f"{referenced_filename}"
                )


def backup_existing_files(changed_files: List[Path]) -> None:
    existing = [path for path in changed_files if path.exists()]
    if not existing:
        return
    backup_dir = BACKUP_ROOT / datetime.now().strftime(
        "%Y%m%d-%H%M%S-%f"
    )
    backup_dir.mkdir(parents=True, exist_ok=False)
    for path in existing:
        shutil.copy2(path, backup_dir / path.name)


def write_if_changed(path: Path, content: bytes) -> bool:
    if path.exists() and path.read_bytes() == content:
        return False
    temporary_path = path.with_name(f".{path.name}.downloading")
    temporary_path.write_bytes(content)
    os.replace(temporary_path, path)
    return True


def main() -> None:
    args = parse_args()
    public_base_url = args.public_base_url.strip()
    if not public_base_url.startswith("https://") or not public_base_url.endswith(
        "/"
    ):
        raise ValueError("Public base URL must be an HTTPS URL ending in '/'.")

    outputs, manifest_entries, _ = collect_assets(public_base_url)
    if INPUT_FORM_NAME in outputs:
        raise ValueError("The unsupported Input form must not be hosted.")
    validate_hosted_references(outputs, public_base_url)

    manifest = {
        "sourceRoot": SOURCE_ROOT,
        "publicBaseUrl": public_base_url,
        "entryPoints": list(ENTRY_POINTS),
        "hostedFiles": manifest_entries,
        "excludedReferences": [
            {
                "filename": INPUT_FORM_NAME,
                "reason": (
                    "Its form posts to http://127.0.0.1/admin/addContact, "
                    "which cannot be provided by GitHub Pages."
                ),
            }
        ],
    }
    manifest_content = (
        json.dumps(manifest, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    desired_files = {
        **outputs,
        "manifest.json": manifest_content,
    }
    changed_paths = [
        OUTPUT_DIR / filename
        for filename, content in desired_files.items()
        if not (OUTPUT_DIR / filename).exists()
        or (OUTPUT_DIR / filename).read_bytes() != content
    ]
    backup_existing_files(changed_paths)

    changed_count = sum(
        write_if_changed(OUTPUT_DIR / filename, content)
        for filename, content in desired_files.items()
    )
    print(
        f"Hosted {len(outputs)} Cisco phone assets; "
        f"updated {changed_count} file{'' if changed_count == 1 else 's'}."
    )


if __name__ == "__main__":
    main()
