# Builtin books

Each builtin course lives in `backend/data/books/<id>/`:

| file | committed | contents |
|---|---|---|
| `meta.json` | yes | id, labels, `pdf_page_offset`, practice anchor; for privately stored books a `pdf_source` |
| `outline.json` | yes | chapter and section titles with printed page ranges (the FOCS shape) |
| `book.pdf` | FOCS only | Lathi's PDF is copyrighted and this repository is public, so it is fetched instead |
| `.build/` | never | build reports |

## Privately stored PDFs

`meta.json` → `pdf_source` pins the exact file: repo, path, commit and SHA-256. To fetch it, use a
fine-grained GitHub token with **Contents: Read-only** on that one repository:

    cd backend
    BOOKS_FETCH_TOKEN="$(cat ~/.config/ai-tutor/books_token)" .venv/bin/python scripts/fetch_private_books.py

Without the token, the script skips the book. The app still starts, and that book shows no pages.

### Render

- Environment: set `BOOKS_FETCH_TOKEN` to that token.
- Build Command (Root Directory `backend`):
  `pip install -r requirements.txt && python scripts/fetch_private_books.py --required`
- If Root Directory is empty (repo root), use
  `pip install -r backend/requirements.txt && python backend/scripts/fetch_private_books.py --required`.

`--required` fails the build when the token is missing or the download does not match its SHA-256.
A failed build never goes live, so a deploy can never ship without its book.

## Lathi (*Linear Systems and Signals*, 3rd ed.)

The PDF has a text layer, so nothing is split, OCR'd or sent to a model. From `backend/`:

    .venv/bin/python -m book_pipeline.lathi outline   # bookmarks + printed CONTENTS -> .build/outline.json, outline_review.md
    # a human checks outline_review.md against the printed CONTENTS (PDF pages 7-16), then:
    cp data/books/lathi/.build/outline.json data/books/lathi/outline.json
    .venv/bin/python -m book_pipeline.lathi verify    # page convention + every section start, through the runtime

### To publish a new PDF

1. Commit it to the private repository.
2. Update `pdf_source.ref`, `sha256` and `bytes` in `lathi/meta.json`.
