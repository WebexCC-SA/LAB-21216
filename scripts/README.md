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

Use this command instead of plain `mkdocs serve` for local previews. The
script starts MkDocs, opens the **Lab (edit)** view, and runs a local-only API
on `127.0.0.1:8765`. That API is required for the DeviceFX workflow because
Webex does not allow browser requests from a localhost origin. It also proxies
the fixed device-list and PhoneOS screenshot operations used by Utilities
during local preview.

Resize an image by dragging its lower-right corner.
When the drag ends, the script updates that image's `width` and `height`
attributes in the existing Lab Markdown file. MkDocs then refreshes both the
normal **Lab** view and **Lab (edit)** view.
The source image file is never resized or rewritten.

Use the left and right arrow buttons over an image to move its display
position horizontally in 16-pixel steps. The editor stores a bounded
`margin-left` value in that image's Markdown attributes, so the alignment also
appears in the normal **Lab** view.

The same local service proxies the fixed, allow-listed Webex API operations
used by the DeviceFX form during local preview because Webex does not permit
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

## Lab filename numbering

Synchronize the Lab 5–12 Markdown filename prefixes with the numbers shown in
the site navigation:

```bash
python scripts/renumber_lab_files.py
```

The script is idempotent, updates `mkdocs.yml`, and creates
`mkdocs.yml.backup.yml` before its first configuration change.

## Cisco phone service assets

Download the approved Cisco phone XML examples and their static dependencies:

```bash
python scripts/download_cisco_phone_assets.py
```

The script starts with Cisco's `menu.xml` and `tornado.xml`, recursively
downloads same-directory XML and PNG dependencies, and stores the hosted copies
under `docs/lab-assets/cisco-phone-services/`. Cisco asset references are
rewritten to the project's GitHub Pages URLs. `manifest.json` records source
URLs, content types, sizes, and SHA-256 checksums.

The **Input** menu entry and `CiscoIPPhoneInput.xml` are intentionally excluded.
That example submits its form to `http://127.0.0.1/admin/addContact`, a dynamic
callback that GitHub Pages cannot provide. Phone actions such as
`Softkey:Update` remain unchanged.

The downloader is idempotent, validates the source host, file types, XML, and
PNG signatures, and backs up changed hosted assets under
`_cisco_phone_assets_backups/`.

Run its local validation tests with:

```bash
venv/bin/python scripts/test_download_cisco_phone_assets.py
```

## DeviceFX activation workflow tests

The DeviceFX NFC activation workflow uses the locally vendored
`qrcode-generator` library documented in
`docs/template_assets/js/vendor/DEPENDENCIES.txt`.

Run its dependency-free Node.js tests from the project root:

```bash
node scripts/test_devicefx_activation.js
node scripts/test_dcloud_storage.js
node scripts/test_webex_access.js
node scripts/test_xapi_playground.js
venv/bin/python scripts/test_webex_proxy.py
```
