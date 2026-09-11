#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from typing import Dict, List, Optional, Set
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DOCS_ROOT = (PROJECT_ROOT / "docs").resolve()
MKDOCS_CONFIG = PROJECT_ROOT / "mkdocs.yml"
BACKUP_ROOT = PROJECT_ROOT / "_image_size_editor_backups"
API_HOST = "127.0.0.1"
API_PORT = 8765
SITE_PORT = 8000
MAX_REQUEST_BYTES = 16 * 1024
MAX_WEBEX_RESPONSE_BYTES = 6 * 1024 * 1024
MAX_UNDO_HISTORY = 100
MIN_DIMENSION = 1
MAX_DIMENSION = 10000
IMAGE_OFFSET_STEP = 16
MAX_IMAGE_OFFSET = 512

IMAGE_RE = re.compile(
    r"!\[(?P<alt>[^\]]*)\]\((?P<target>[^)\r\n]+)\)"
    r"(?P<attrs>\{[^}\r\n]*\})?",
    re.DOTALL,
)
SIZE_ATTRIBUTE_RE = re.compile(
    r"\b(?:width|height)\s*=\s*"
    r"(?:\"[^\"]*\"|'[^']*'|[^\s}]+)",
    re.IGNORECASE,
)
STYLE_ATTRIBUTE_RE = re.compile(
    r"\bstyle\s*=\s*(?:\"(?P<double>[^\"]*)\"|'(?P<single>[^']*)')",
    re.IGNORECASE,
)
MARGIN_LEFT_RE = re.compile(
    r"(?:^|;)\s*margin-left\s*:\s*[^;]+;?",
    re.IGNORECASE,
)
MARGIN_LEFT_VALUE_RE = re.compile(
    r"(?:^|;)\s*margin-left\s*:\s*(?P<offset>\d+)px\s*;?",
    re.IGNORECASE,
)
LAB_NAV_RE = re.compile(r"^(?P<indent>\s*)-\s+Lab:\s*(?:#.*)?$")
NAV_ITEM_RE = re.compile(r"^\s*-\s+[^:]+:\s*(?P<page>[^\s#]+\.md)\s*(?:#.*)?$")
HEADING_RE = re.compile(r"^#{1,6}\s+")
ORDERED_LIST_RE = re.compile(
    r"^(?P<indent>[ \t]*)(?P<number>\d+)\.(?P<spacing>\s+)(?P<text>.*)$"
)
BEARER_TOKEN_RE = re.compile(r"^[A-Za-z0-9._~+/=-]{20,8192}$")
WEBEX_ID_RE = re.compile(r"^[A-Za-z0-9._~+/=-]{1,512}$")
WEBEX_PEOPLE_URL = (
    "https://webexapis.com/v1/people?callingData=true&max=100"
)
WEBEX_ACTIVATION_URL = (
    "https://webexapis.com/v1/devices/activationCode"
)
WEBEX_DEVICES_URL = "https://webexapis.com/v1/devices?max=100"
WEBEX_XAPI_SCREENSHOT_URL = (
    "https://webexapis.com/v1/xapi/command/Ui.GetDeviceScreenshot"
)
WEBEX_MODELS = {"Cisco 9871", "Cisco 9861"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Run the local Lab (edit) formatting editor and MkDocs preview."
        )
    )
    parser.add_argument(
        "--no-mkdocs",
        action="store_true",
        help="Run only the edit API when MkDocs is already running on port 8000",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open the Lab (edit) page automatically",
    )
    return parser.parse_args()


def load_lab_pages(config_path: Path) -> List[str]:
    pages: List[str] = []
    lab_indent: Optional[int] = None
    for line in config_path.read_text(encoding="utf-8").splitlines():
        if lab_indent is None:
            match = LAB_NAV_RE.match(line)
            if match:
                lab_indent = len(match.group("indent"))
            continue

        stripped = line.lstrip()
        indentation = len(line) - len(stripped)
        if stripped.startswith("- ") and indentation <= lab_indent:
            break
        page_match = NAV_ITEM_RE.match(line)
        if page_match:
            pages.append(page_match.group("page"))

    if not pages:
        raise ValueError('No pages were found under the "Lab" navigation entry.')
    return pages


def page_route(page: str) -> str:
    path = PurePosixPath(page)
    if path.name == "index.md":
        route = path.parent.as_posix()
    else:
        route = path.with_suffix("").as_posix()
    return "" if route == "." else f"{route.strip('/')}/"


def canonical_asset_path(value: str) -> str:
    path = unquote(urlsplit(value.strip()).path).replace("\\", "/")
    marker = "/assets/"
    if marker in path:
        path = f"assets/{path.split(marker, 1)[1]}"
    path = path.removeprefix("./").lstrip("/")
    normalized = PurePosixPath(path)
    if (
        not normalized.parts
        or normalized.parts[0] != "assets"
        or ".." in normalized.parts
    ):
        raise ValueError("Image source must resolve inside docs/assets.")
    return normalized.as_posix()


def markdown_target_path(target: str) -> str:
    value = target.strip()
    if value.startswith("<") and ">" in value:
        value = value[1 : value.index(">")]
    else:
        value = value.split(maxsplit=1)[0]
    return canonical_asset_path(value)


def merge_size_attributes(
    existing_attributes: Optional[str], width: int, height: int
) -> str:
    remaining = ""
    if existing_attributes:
        remaining = SIZE_ATTRIBUTE_RE.sub(
            "", existing_attributes[1:-1]
        ).strip()
        remaining = re.sub(r"\s+", " ", remaining)
    suffix = f" {remaining}" if remaining else ""
    return f'{{ width="{width}" height="{height}"{suffix} }}'


def merge_horizontal_offset(
    existing_attributes: Optional[str], offset: int
) -> str:
    remaining = ""
    style_value = ""
    if existing_attributes:
        inner = existing_attributes[1:-1]
        style_match = STYLE_ATTRIBUTE_RE.search(inner)
        if style_match:
            style_value = (
                style_match.group("double")
                if style_match.group("double") is not None
                else style_match.group("single") or ""
            )
            inner = (
                inner[: style_match.start()]
                + inner[style_match.end() :]
            )
        remaining = re.sub(r"\s+", " ", inner).strip()

    style_value = MARGIN_LEFT_RE.sub(";", style_value)
    declarations = [
        declaration.strip()
        for declaration in style_value.split(";")
        if declaration.strip()
    ]
    if offset:
        declarations.append(f"margin-left: {offset}px")
    style_attribute = (
        f' style="{"; ".join(declarations)};"' if declarations else ""
    )
    remaining_attributes = f" {remaining}" if remaining else ""
    if not style_attribute and not remaining_attributes:
        return ""
    return f"{{{style_attribute}{remaining_attributes} }}"


def proxy_webex_request(
    operation: str, payload: Dict[str, object]
) -> tuple[HTTPStatus, Dict[str, object]]:
    token = payload.get("bearer_token")
    if not isinstance(token, str) or not BEARER_TOKEN_RE.fullmatch(token):
        raise ValueError("Invalid Webex bearer token format.")

    if operation == "people":
        request = Request(
            WEBEX_PEOPLE_URL,
            method="GET",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {token}",
            },
        )
    elif operation == "devices":
        request = Request(
            WEBEX_DEVICES_URL,
            method="GET",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {token}",
            },
        )
    elif operation == "activation":
        person_id = payload.get("person_id")
        model = payload.get("model")
        if (
            not isinstance(person_id, str)
            or not WEBEX_ID_RE.fullmatch(person_id)
        ):
            raise ValueError("Invalid Webex person ID.")
        if model not in WEBEX_MODELS:
            raise ValueError("Invalid phone model.")
        body = json.dumps(
            {"personId": person_id, "model": model}
        ).encode("utf-8")
        request = Request(
            WEBEX_ACTIVATION_URL,
            data=body,
            method="POST",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
    elif operation == "xapi-screenshot":
        device_id = payload.get("device_id")
        if (
            not isinstance(device_id, str)
            or not WEBEX_ID_RE.fullmatch(device_id)
        ):
            raise ValueError("Invalid Webex device ID.")
        body = json.dumps({"deviceId": device_id}).encode("utf-8")
        request = Request(
            WEBEX_XAPI_SCREENSHOT_URL,
            data=body,
            method="POST",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
    else:
        raise ValueError("Invalid Webex proxy operation.")

    try:
        with urlopen(request, timeout=15) as response:
            status = HTTPStatus(response.status)
            response_body = response.read(MAX_WEBEX_RESPONSE_BYTES + 1)
            content_type = response.headers.get_content_type()
    except HTTPError as error:
        status = HTTPStatus(error.code)
        response_body = error.read(MAX_WEBEX_RESPONSE_BYTES + 1)
        content_type = error.headers.get_content_type()
    except (URLError, TimeoutError):
        return (
            HTTPStatus.BAD_GATEWAY,
            {"error": "The local editor could not reach the Webex API."},
        )

    if len(response_body) > MAX_WEBEX_RESPONSE_BYTES:
        return (
            HTTPStatus.BAD_GATEWAY,
            {"error": "The Webex API response exceeded the size limit."},
        )
    if status == HTTPStatus.NO_CONTENT and not response_body:
        return status, {}
    if content_type != "application/json":
        return (
            HTTPStatus.BAD_GATEWAY,
            {"error": "Webex returned an unexpected response format."},
        )
    try:
        data = json.loads(response_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return (
            HTTPStatus.BAD_GATEWAY,
            {"error": "Webex returned invalid JSON."},
        )
    if not isinstance(data, dict):
        return (
            HTTPStatus.BAD_GATEWAY,
            {"error": "Webex returned an invalid response object."},
        )
    return status, data


class LabMarkdownUpdater:
    def __init__(self, allowed_pages: List[str]) -> None:
        self.allowed_pages = set(allowed_pages)
        self.backed_up: Set[str] = set()
        self.history: List[Dict[str, str]] = []
        self.backup_session = datetime.now().strftime("%Y%m%d-%H%M%S")
        self.lock = threading.Lock()

    def update(
        self,
        page: str,
        source: str,
        occurrence: int,
        width: int,
        height: int,
    ) -> Dict[str, object]:
        if page not in self.allowed_pages:
            raise ValueError("The requested page is not in the Lab navigation.")
        if occurrence < 0:
            raise ValueError("Image occurrence must be zero or greater.")
        if not (
            MIN_DIMENSION <= width <= MAX_DIMENSION
            and MIN_DIMENSION <= height <= MAX_DIMENSION
        ):
            raise ValueError(
                f"Dimensions must be between {MIN_DIMENSION} and "
                f"{MAX_DIMENSION} pixels."
            )

        canonical_source = canonical_asset_path(source)
        page_path = (DOCS_ROOT / page).resolve()
        if DOCS_ROOT not in page_path.parents or page_path.suffix != ".md":
            raise ValueError("Invalid Markdown page path.")
        if not page_path.is_file():
            raise FileNotFoundError(f"Markdown page not found: {page}")

        with self.lock:
            original = page_path.read_text(encoding="utf-8")
            selected_match = self._find_image_match(
                original, canonical_source, occurrence
            )

            replacement = (
                selected_match.group(0)[
                    : len(selected_match.group(0))
                    - len(selected_match.group("attrs") or "")
                ]
                + merge_size_attributes(
                    selected_match.group("attrs"), width, height
                )
            )
            updated = (
                original[: selected_match.start()]
                + replacement
                + original[selected_match.end() :]
            )
            self._backup_once(page, page_path)
            self._atomic_write(page_path, updated)
            self._record_history(page, original)

        return {
            "page": page,
            "source": canonical_source,
            "occurrence": occurrence,
            "width": width,
            "height": height,
        }

    def move_image(
        self, page: str, source: str, occurrence: int, direction: str
    ) -> Dict[str, object]:
        if page not in self.allowed_pages:
            raise ValueError("The requested page is not in the Lab navigation.")
        if occurrence < 0:
            raise ValueError("Image occurrence must be zero or greater.")
        if direction not in {"right", "left"}:
            raise ValueError("Image direction must be either right or left.")

        canonical_source = canonical_asset_path(source)
        page_path = (DOCS_ROOT / page).resolve()
        if DOCS_ROOT not in page_path.parents or page_path.suffix != ".md":
            raise ValueError("Invalid Markdown page path.")
        if not page_path.is_file():
            raise FileNotFoundError(f"Markdown page not found: {page}")

        with self.lock:
            original = page_path.read_text(encoding="utf-8")
            selected_match = self._find_image_match(
                original, canonical_source, occurrence
            )
            attributes = selected_match.group("attrs")
            current_offset = 0
            if attributes:
                style_match = STYLE_ATTRIBUTE_RE.search(attributes)
                if style_match:
                    style_value = (
                        style_match.group("double")
                        if style_match.group("double") is not None
                        else style_match.group("single") or ""
                    )
                    offset_match = MARGIN_LEFT_VALUE_RE.search(style_value)
                    if offset_match:
                        current_offset = int(offset_match.group("offset"))

            change = IMAGE_OFFSET_STEP if direction == "right" else -IMAGE_OFFSET_STEP
            offset = max(
                0, min(MAX_IMAGE_OFFSET, current_offset + change)
            )
            if offset == current_offset:
                raise ValueError(
                    "The image is already at the horizontal movement limit."
                )

            image_without_attributes = selected_match.group(0)[
                : len(selected_match.group(0)) - len(attributes or "")
            ]
            replacement = (
                image_without_attributes
                + merge_horizontal_offset(attributes, offset)
            )
            updated = (
                original[: selected_match.start()]
                + replacement
                + original[selected_match.end() :]
            )
            self._backup_once(page, page_path)
            self._atomic_write(page_path, updated)
            self._record_history(page, original)

        return {
            "page": page,
            "source": canonical_source,
            "occurrence": occurrence,
            "direction": direction,
            "offset": offset,
            "maximum_offset": MAX_IMAGE_OFFSET,
        }

    def move_list_items(
        self, page: str, selected_indices: List[int], direction: str
    ) -> Dict[str, object]:
        if page not in self.allowed_pages:
            raise ValueError("The requested page is not in the Lab navigation.")
        if direction not in {"right", "left"}:
            raise ValueError("List direction must be either right or left.")
        if (
            not selected_indices
            or len(selected_indices) > 100
            or any(index < 0 for index in selected_indices)
        ):
            raise ValueError("Select between 1 and 100 numbered list items.")
        indices = sorted(set(selected_indices))
        if len(indices) != len(selected_indices):
            raise ValueError("Selected list item indices must be unique.")

        page_path = (DOCS_ROOT / page).resolve()
        if DOCS_ROOT not in page_path.parents or page_path.suffix != ".md":
            raise ValueError("Invalid Markdown page path.")
        if not page_path.is_file():
            raise FileNotFoundError(f"Markdown page not found: {page}")

        with self.lock:
            original = page_path.read_text(encoding="utf-8")
            lines = original.splitlines()
            markers: List[Dict[str, int]] = []
            for line_index, line in enumerate(lines):
                match = ORDERED_LIST_RE.match(line)
                if match:
                    markers.append(
                        {
                            "line": line_index,
                            "level": len(
                                match.group("indent").expandtabs(4)
                            )
                            // 4,
                        }
                    )

            if indices[-1] >= len(markers):
                raise ValueError("The selected list item is no longer available.")
            selected_positions = set(indices)
            selected_markers = [markers[index] for index in indices]
            levels = {marker["level"] for marker in selected_markers}
            if len(levels) != 1:
                raise ValueError("Selected items must be at the same list level.")
            level = levels.pop()
            if direction == "right" and level != 0:
                raise ValueError(
                    "Only first-level list items can be indented right."
                )
            if direction == "left" and level != 1:
                raise ValueError(
                    "Only second-level list items can be indented left."
                )

            first_position = indices[0]
            last_position = indices[-1]
            for position in range(first_position, last_position + 1):
                marker_level = markers[position]["level"]
                if marker_level < level:
                    raise ValueError(
                        "The selection cannot cross a parent list boundary."
                    )
                if marker_level == level and position not in selected_positions:
                    raise ValueError("Selected sibling items must be consecutive.")

            first_line = selected_markers[0]["line"]
            last_line = selected_markers[-1]["line"]
            if any(
                HEADING_RE.match(lines[index])
                for index in range(first_line, last_line + 1)
            ):
                raise ValueError("The selection cannot cross a heading.")

            section_start = -1
            for line_index in range(first_line - 1, -1, -1):
                if HEADING_RE.match(lines[line_index]):
                    section_start = line_index
                    break

            parent_marker: Optional[Dict[str, int]] = None
            for position in range(first_position - 1, -1, -1):
                marker = markers[position]
                if marker["line"] <= section_start:
                    break
                if marker["level"] == 0:
                    parent_marker = marker
                    break
            if parent_marker is None:
                raise ValueError(
                    "The selected items do not have a first-level parent item."
                )

            block_end = len(lines)
            for position in range(last_position + 1, len(markers)):
                marker = markers[position]
                if marker["level"] <= level:
                    block_end = marker["line"]
                    break
            for line_index in range(last_line + 1, block_end):
                if HEADING_RE.match(lines[line_index]):
                    block_end = line_index
                    break

            parent_match = ORDERED_LIST_RE.match(lines[parent_marker["line"]])
            if parent_match is None:
                raise ValueError("The parent list item could not be read.")
            parent_number = int(parent_match.group("number"))
            selected_start_number = 1 if direction == "right" else parent_number + 1
            for item_number, marker in enumerate(
                selected_markers, start=selected_start_number
            ):
                match = ORDERED_LIST_RE.match(lines[marker["line"]])
                if match:
                    lines[marker["line"]] = (
                        f'{match.group("indent")}{item_number}.'
                        f'{match.group("spacing")}{match.group("text")}'
                    )

            if direction == "right":
                for line_index in range(first_line, block_end):
                    if lines[line_index].strip():
                        lines[line_index] = f"    {lines[line_index]}"
            else:
                for line_index in range(first_line, block_end):
                    if lines[line_index].startswith("    "):
                        lines[line_index] = lines[line_index][4:]
                    elif lines[line_index].startswith("\t"):
                        lines[line_index] = lines[line_index][1:]

            next_number = (
                parent_number + 1
                if direction == "right"
                else parent_number + len(indices) + 1
            )
            nested_number = 1
            for line_index in range(block_end, len(lines)):
                if HEADING_RE.match(lines[line_index]):
                    break
                match = ORDERED_LIST_RE.match(lines[line_index])
                if not match:
                    continue
                marker_level = len(match.group("indent").expandtabs(4)) // 4
                if direction == "right":
                    if marker_level == 0:
                        lines[line_index] = (
                            f'{match.group("indent")}{next_number}.'
                            f'{match.group("spacing")}{match.group("text")}'
                        )
                        next_number += 1
                else:
                    if marker_level == 0:
                        lines[line_index] = (
                            f'{match.group("indent")}{next_number}.'
                            f'{match.group("spacing")}{match.group("text")}'
                        )
                        next_number += 1
                        nested_number = 1
                    elif marker_level == 1:
                        lines[line_index] = (
                            f'{match.group("indent")}{nested_number}.'
                            f'{match.group("spacing")}{match.group("text")}'
                        )
                        nested_number += 1

            if (
                block_end < len(lines)
                and block_end > 0
                and lines[block_end - 1].strip()
            ):
                lines.insert(block_end, "")
            if (
                direction == "left"
                and first_line > 0
                and lines[first_line - 1].strip()
            ):
                lines.insert(first_line, "")

            updated = "\n".join(lines)
            if original.endswith("\n"):
                updated += "\n"
            self._backup_once(page, page_path)
            self._atomic_write(page_path, updated)
            self._record_history(page, original)

        return {
            "page": page,
            "selected_indices": indices,
            "direction": direction,
            "moved_items": len(indices),
        }

    def undo(self) -> Dict[str, object]:
        with self.lock:
            if not self.history:
                raise ValueError("There are no editor changes to undo.")
            previous = self.history.pop()
            page = previous["page"]
            page_path = (DOCS_ROOT / page).resolve()
            if DOCS_ROOT not in page_path.parents or page_path.suffix != ".md":
                raise ValueError("Invalid Markdown page path in undo history.")
            self._atomic_write(page_path, previous["content"])
        return {"page": page, "remaining_undo_count": len(self.history)}

    def _record_history(self, page: str, content: str) -> None:
        self.history.append({"page": page, "content": content})
        if len(self.history) > MAX_UNDO_HISTORY:
            del self.history[0]

    @staticmethod
    def _find_image_match(
        markdown: str, canonical_source: str, occurrence: int
    ) -> re.Match[str]:
        matching_index = -1
        for match in IMAGE_RE.finditer(markdown):
            try:
                match_source = markdown_target_path(match.group("target"))
            except ValueError:
                continue
            if match_source != canonical_source:
                continue
            matching_index += 1
            if matching_index == occurrence:
                return match
        raise ValueError(
            "The selected image was not found in the Markdown page."
        )

    def _backup_once(self, page: str, page_path: Path) -> None:
        if page in self.backed_up:
            return
        backup_path = (
            BACKUP_ROOT / self.backup_session / PurePosixPath(page)
        )
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(page_path, backup_path)
        self.backed_up.add(page)

    @staticmethod
    def _atomic_write(page_path: Path, content: str) -> None:
        mode = page_path.stat().st_mode
        temporary_name = ""
        try:
            with tempfile.NamedTemporaryFile(
                "w",
                encoding="utf-8",
                dir=page_path.parent,
                prefix=f".{page_path.name}.",
                suffix=".tmp",
                delete=False,
            ) as temporary:
                temporary.write(content)
                temporary.flush()
                os.fsync(temporary.fileno())
                temporary_name = temporary.name
            os.chmod(temporary_name, mode)
            os.replace(temporary_name, page_path)
        finally:
            if temporary_name and os.path.exists(temporary_name):
                os.unlink(temporary_name)


def build_handler(
    pages: List[str], token: str, updater: LabMarkdownUpdater
) -> type[BaseHTTPRequestHandler]:
    routes = [{"source": page, "route": page_route(page)} for page in pages]
    allowed_origins = {
        f"http://127.0.0.1:{SITE_PORT}",
        f"http://localhost:{SITE_PORT}",
    }

    class EditorHandler(BaseHTTPRequestHandler):
        server_version = "LabImageEditor/1.0"

        def do_OPTIONS(self) -> None:
            if not self._origin_allowed():
                self._send_json(
                    HTTPStatus.FORBIDDEN, {"error": "Origin is not allowed."}
                )
                return
            self.send_response(HTTPStatus.NO_CONTENT)
            self._send_common_headers()
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header(
                "Access-Control-Allow-Headers",
                "Content-Type, X-Image-Editor-Token",
            )
            self.end_headers()

        def do_GET(self) -> None:
            if self.path != "/config":
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
                return
            if not self._origin_allowed():
                self._send_json(
                    HTTPStatus.FORBIDDEN, {"error": "Origin is not allowed."}
                )
                return
            self._send_json(
                HTTPStatus.OK,
                {
                    "token": token,
                    "pages": routes,
                    "image_offset_step": IMAGE_OFFSET_STEP,
                    "max_image_offset": MAX_IMAGE_OFFSET,
                },
            )

        def do_POST(self) -> None:
            if self.path not in {
                "/resize",
                "/move-image",
                "/move-list",
                "/undo",
                "/webex-proxy/people",
                "/webex-proxy/devices",
                "/webex-proxy/activation",
                "/webex-proxy/xapi-screenshot",
            }:
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
                return
            if not self._origin_allowed():
                self._send_json(
                    HTTPStatus.FORBIDDEN, {"error": "Origin is not allowed."}
                )
                return
            if not secrets.compare_digest(
                self.headers.get("X-Image-Editor-Token", ""), token
            ):
                self._send_json(
                    HTTPStatus.FORBIDDEN, {"error": "Invalid editor token."}
                )
                return
            if self.headers.get("Content-Type", "").split(";", 1)[0] != (
                "application/json"
            ):
                self._send_json(
                    HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
                    {"error": "Content-Type must be application/json."},
                )
                return
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                content_length = 0
            if not 0 < content_length <= MAX_REQUEST_BYTES:
                self._send_json(
                    HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                    {"error": "Invalid request size."},
                )
                return

            try:
                payload = json.loads(
                    self.rfile.read(content_length).decode("utf-8")
                )
                if self.path == "/resize":
                    result = updater.update(
                        page=str(payload["page"]),
                        source=str(payload["source"]),
                        occurrence=int(payload.get("occurrence", 0)),
                        width=int(payload["width"]),
                        height=int(payload["height"]),
                    )
                elif self.path == "/move-image":
                    result = updater.move_image(
                        page=str(payload["page"]),
                        source=str(payload["source"]),
                        occurrence=int(payload.get("occurrence", 0)),
                        direction=str(payload["direction"]),
                    )
                elif self.path == "/move-list":
                    raw_indices = payload["selected_indices"]
                    if not isinstance(raw_indices, list):
                        raise ValueError(
                            "selected_indices must be a JSON array."
                        )
                    result = updater.move_list_items(
                        page=str(payload["page"]),
                        selected_indices=[
                            int(index) for index in raw_indices
                        ],
                        direction=str(payload["direction"]),
                    )
                elif self.path.startswith("/webex-proxy/"):
                    operation = self.path.rsplit("/", 1)[-1]
                    proxy_status, proxy_result = proxy_webex_request(
                        operation, payload
                    )
                    self._send_json(proxy_status, proxy_result)
                    return
                else:
                    result = updater.undo()
            except (KeyError, TypeError, ValueError, FileNotFoundError) as error:
                self._send_json(
                    HTTPStatus.BAD_REQUEST, {"error": str(error)}
                )
                return
            self._send_json(HTTPStatus.OK, {"updated": result})

        def _origin_allowed(self) -> bool:
            return self.headers.get("Origin") in allowed_origins

        def _send_common_headers(self) -> None:
            origin = self.headers.get("Origin")
            if origin in allowed_origins:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")

        def _send_json(
            self, status: HTTPStatus, payload: Dict[str, object]
        ) -> None:
            encoded = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self._send_common_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def log_message(self, format_string: str, *args: object) -> None:
            print(f"[editor-api] {format_string % args}")

    return EditorHandler


def main() -> None:
    args = parse_args()
    pages = load_lab_pages(MKDOCS_CONFIG)
    token = secrets.token_urlsafe(32)
    updater = LabMarkdownUpdater(pages)
    handler = build_handler(pages, token, updater)
    api_server = ThreadingHTTPServer((API_HOST, API_PORT), handler)
    api_thread = threading.Thread(
        target=api_server.serve_forever, name="image-editor-api", daemon=True
    )
    api_thread.start()

    mkdocs_process: Optional[subprocess.Popen[bytes]] = None
    try:
        if not args.no_mkdocs:
            mkdocs_process = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "mkdocs",
                    "serve",
                    "--config-file",
                    "mkdocs.local.yml",
                    "--dev-addr",
                    f"127.0.0.1:{SITE_PORT}",
                ],
                cwd=PROJECT_ROOT,
            )

        first_route = page_route(pages[0])
        editor_url = (
            f"http://127.0.0.1:{SITE_PORT}/{first_route}?image-edit=1"
        )
        print(f"Lab formatting editor API: http://{API_HOST}:{API_PORT}")
        print(f"Lab (edit): {editor_url}")
        print("Press Ctrl+C to stop the editor.")
        if not args.no_browser:
            time.sleep(1)
            webbrowser.open(editor_url)

        while mkdocs_process is None or mkdocs_process.poll() is None:
            time.sleep(0.5)
        raise RuntimeError(
            f"MkDocs stopped unexpectedly with code {mkdocs_process.returncode}."
        )
    except KeyboardInterrupt:
        print("\nStopping Lab image editor.")
    finally:
        api_server.shutdown()
        api_server.server_close()
        if mkdocs_process is not None and mkdocs_process.poll() is None:
            mkdocs_process.terminate()
            try:
                mkdocs_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                mkdocs_process.kill()
                mkdocs_process.wait(timeout=5)


if __name__ == "__main__":
    main()
