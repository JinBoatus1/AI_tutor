#!/usr/bin/env python3
"""Fetch builtin-book PDFs that are kept out of the public repository.

For every backend/data/books/<id>/meta.json with a "pdf_source", download book.pdf
from the private GitHub repo it names, check its SHA-256, and move it into place.

Render (build step):  python scripts/fetch_private_books.py --required
Locally, without BOOKS_FETCH_TOKEN, missing books are reported and skipped.
"""

from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import os
import sys
import tempfile
import urllib.error
import urllib.request

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_BOOKS_DIR = os.path.join(BACKEND, "data", "books")
TOKEN_ENV = "BOOKS_FETCH_TOKEN"


class FetchError(RuntimeError):
    pass


def sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _request(source: dict, token: str) -> urllib.request.Request:
    url = f"https://api.github.com/repos/{source['repo']}/contents/{source['path']}?ref={source['ref']}"
    return urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.raw+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ai-tutor-book-fetch",
    })


def fetch_one(book_dir: str, source: dict, token, *, urlopen=urllib.request.urlopen) -> str:
    dest = os.path.join(book_dir, "book.pdf")
    want = str(source["sha256"]).lower()
    if os.path.isfile(dest) and sha256_file(dest) == want:
        return "present"
    if not token:
        return "skipped-no-token-stale" if os.path.isfile(dest) else "skipped-no-token"
    fd, tmp = tempfile.mkstemp(dir=book_dir, prefix=".book.pdf.", suffix=".part")
    try:
        digest = hashlib.sha256()
        with os.fdopen(fd, "wb") as out:
            try:
                resp = urlopen(_request(source, token), timeout=300)
            except urllib.error.HTTPError as e:
                raise FetchError(
                    f"HTTP {e.code} fetching {source['repo']}/{source['path']}; check {TOKEN_ENV} "
                    "(fine-grained, Contents: read-only on that repo) and the pinned ref"
                ) from e
            with resp:
                for chunk in iter(lambda: resp.read(1 << 20), b""):
                    out.write(chunk)
                    digest.update(chunk)
        if digest.hexdigest() != want:
            raise FetchError(f"the download's sha256 is {digest.hexdigest()}, meta.json expects {want}")
        os.replace(tmp, dest)
        return "downloaded"
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def main(argv=None, *, env=os.environ, urlopen=urllib.request.urlopen) -> int:
    ap = argparse.ArgumentParser(description="Fetch privately stored builtin-book PDFs.")
    ap.add_argument("--required", action="store_true",
                    help="fail when the token is missing or a download fails (use on Render)")
    ap.add_argument("--books-dir", default=DEFAULT_BOOKS_DIR)
    args = ap.parse_args(argv)
    token = (env.get(TOKEN_ENV) or "").strip() or None
    status = 0
    for book_id in sorted(os.listdir(args.books_dir)):
        meta_path = os.path.join(args.books_dir, book_id, "meta.json")
        if not os.path.isfile(meta_path):
            continue
        with open(meta_path, encoding="utf-8") as f:
            source = json.load(f).get("pdf_source")
        if not source:
            continue
        try:
            result = fetch_one(os.path.join(args.books_dir, book_id), source, token, urlopen=urlopen)
        except (FetchError, OSError, http.client.HTTPException) as e:
            print(f"[books] {book_id}: FAILED: {e}", file=sys.stderr)
            status = 1
            continue
        if result in ("skipped-no-token", "skipped-no-token-stale"):
            if result == "skipped-no-token":
                message = f"[books] {book_id}: book.pdf is missing and {TOKEN_ENV} is not set"
                suffix = " (skipped; this book has no page images locally)"
            else:
                message = f"[books] {book_id}: book.pdf does not match meta.json's sha256 and {TOKEN_ENV} is not set"
                suffix = " (skipped; the local copy is out of date)"
            if args.required:
                print(message, file=sys.stderr)
                status = 1
            else:
                print(message + suffix)
        else:
            print(f"[books] {book_id}: {result}")
    return status


if __name__ == "__main__":
    sys.exit(main())
