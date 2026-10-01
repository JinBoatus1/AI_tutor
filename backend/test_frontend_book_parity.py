"""Every backend builtin needs its three frontend edits (spec §7 AC5), and the
bundled tree must equal the backend outline (catches a forgotten `npm run sync-focs`)."""

import json
import os
import re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOKS = os.path.join(REPO, "backend", "data", "books")
SYNC = os.path.join(REPO, "frontend", "scripts", "sync-focs-tree.mjs")
REGISTRY = os.path.join(REPO, "frontend", "src", "books", "registry.ts")


def _builtin_ids():
    return sorted(d for d in os.listdir(BOOKS) if os.path.isfile(os.path.join(BOOKS, d, "meta.json")))


def _tree_files():
    with open(SYNC, encoding="utf-8") as f:
        body = re.search(r"const TREE_FILE = \{([^}]*)\}", f.read()).group(1)
    return dict(re.findall(r'(\w+):\s*"([^"]+)"', body))


def test_every_builtin_book_has_all_three_frontend_edits():
    files = _tree_files()
    with open(REGISTRY, encoding="utf-8") as f:
        registry = f.read()
    for book_id in _builtin_ids():
        assert book_id in files, f"{book_id}: add it to TREE_FILE in frontend/scripts/sync-focs-tree.mjs"
        assert f'from "../data/{files[book_id]}"' in registry, f"{book_id}: registry.ts must import ../data/{files[book_id]}"
        assert re.search(rf"^\s*{re.escape(book_id)}: \{{", registry, re.M), f"{book_id}: add a BOOKS entry in registry.ts"


def test_bundled_trees_match_the_backend_outlines():
    for book_id, name in _tree_files().items():
        with open(os.path.join(BOOKS, book_id, "outline.json"), encoding="utf-8") as f:
            backend = json.load(f)
        with open(os.path.join(REPO, "frontend", "src", "data", name), encoding="utf-8") as f:
            bundled = json.load(f)
        assert bundled == backend, f"{name} is stale: run `npm run sync-focs` in frontend/"
