# Project scripts

## DOCX converter

Convert a Word lab guide into Markdown:

```bash
python scripts/docx_to_markdown.py path/to/guide.docx
```

## Lab formatting editor

Start the local editor:

```bash
python scripts/image_size_editor.py
```

The script starts MkDocs, opens the **Lab (edit)** view, and runs a local-only
API on `127.0.0.1:8765`. Resize an image by dragging its lower-right corner.
When the drag ends, the script updates that image's `width` and `height`
attributes in the existing Lab Markdown file. MkDocs then refreshes both the
normal **Lab** view and **Lab (edit)** view.
The source image file is never resized or rewritten.

Use the left and right arrow buttons over an image to move its display
position horizontally in 16-pixel steps. The editor stores a bounded
`margin-left` value in that image's Markdown attributes, so the alignment also
appears in the normal **Lab** view.

The same local service proxies the two fixed Webex API endpoints used by the
DeviceFX activation form during local preview because Webex does not permit
browser CORS requests from `localhost`. The proxy validates request fields,
does not store or log bearer tokens, and is not used on the published GitHub
Pages site.

To indent numbered list items, choose **Start indent edit mode** in the edit
bar. Selection boxes then appear next to the numbered items. Select the first
item and Shift-click the last item (or select each item separately), then
choose an available direction:

- **Indent right** is available for first-level items. It adds four spaces to
  the selected items and their intervening content,
  including images
- **Indent left** is available for second-level items. It removes four spaces
  and brings the items back to the first level

The editor renumbers affected items automatically. Choose **Stop indent edit
mode** to hide the selection boxes without leaving **Lab (edit)**. Choose
**Undo last edit** to reverse the most recent image resize or list edit in the
current editor session.

If MkDocs is already running on `127.0.0.1:8000`, use:

```bash
python scripts/image_size_editor.py --no-mkdocs
```

Backups are created under `_image_size_editor_backups/` before a page is
changed for the first time in each editor session.

The **Lab (edit)** tab is visible only while the local editor API is running.
The editor starts MkDocs with `mkdocs.local.yml`; the published GitHub Pages
site builds from `mkdocs.yml` and does not load the editor. Stop the script
with `Ctrl+C` to hide the local tab.

## Environment

From the project root:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements_dev.txt
```

The converter's direct dependencies are pinned in `scripts/requirements.txt`
for reproducibility.

## DeviceFX activation workflow tests

The DeviceFX NFC activation workflow uses the locally vendored
`qrcode-generator` library documented in
`docs/template_assets/js/vendor/DEPENDENCIES.txt`.

Run its dependency-free Node.js tests from the project root:

```bash
node scripts/test_devicefx_activation.js
```
