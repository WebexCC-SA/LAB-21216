# Lab Guide for WebexOne Lab LAB-21216

Web guide link: https://webexcc-sa.github.io/LAB-21216/


## DOCX to Markdown script

Use `scripts/docx_to_markdown.py` to convert a DOCX lab guide into markdown files.

### What it does

- Reads one `.docx` input file
- Extracts all embedded images into `docs/assets/` (or a custom assets directory)
- Reuses identical existing image files instead of creating duplicates
- Preserves ordered-list continuation and nested-list indentation
- Splits each Heading 1/Heading 2 that starts with `Lab` into its own markdown file in `docs/`
- Writes all non-lab content to `docs/non-lab.md`
- Renames existing output files with a timestamp before writing replacements

### Usage

```bash
python scripts/docx_to_markdown.py path/to/guide.docx
```

Optional arguments:

- `--docs-dir` (default: `docs`)
- `--assets-dir` (default: `<docs-dir>/assets`)

## Edit Lab formatting

Run `python scripts/image_size_editor.py`, then use the temporary
**Lab (edit)** tab to resize images or indent consecutive numbered list items.
See `scripts/README.md` for usage, backups, and removal instructions.
