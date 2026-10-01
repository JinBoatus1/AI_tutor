"""Build-time fetch of privately stored book PDFs."""

import hashlib
import http.client
import io
import json
import urllib.error

from scripts import fetch_private_books as fpb

DATA = b"%PDF-1.7 fake book bytes"
SHA = hashlib.sha256(DATA).hexdigest()


def _books(tmp_path, sha=SHA):
    books = tmp_path / "books"
    (books / "lathi").mkdir(parents=True)
    (books / "lathi" / "meta.json").write_text(json.dumps({
        "id": "lathi",
        "pdf_source": {"kind": "github_private", "repo": "owner/private-books", "path": "lathi/book.pdf",
                       "ref": "a" * 40, "sha256": sha, "bytes": len(DATA)},
    }))
    (books / "focs").mkdir()
    (books / "focs" / "meta.json").write_text('{"id": "focs"}')
    return books


def _opener(data=DATA, seen=None):
    def urlopen(req, timeout=None):
        if seen is not None:
            seen.append(req)
        return io.BytesIO(data)
    return urlopen


def test_downloads_verifies_and_moves_the_pdf_into_place(tmp_path):
    books = _books(tmp_path)
    rc = fpb.main(["--books-dir", str(books), "--required"], env={"BOOKS_FETCH_TOKEN": "t"}, urlopen=_opener())
    assert rc == 0 and (books / "lathi" / "book.pdf").read_bytes() == DATA
    assert not list((books / "lathi").glob("*.part"))
    assert not (books / "focs" / "book.pdf").exists()


def test_checksum_mismatch_fails_and_leaves_no_file(tmp_path):
    books = _books(tmp_path, sha="0" * 64)
    rc = fpb.main(["--books-dir", str(books), "--required"], env={"BOOKS_FETCH_TOKEN": "t"}, urlopen=_opener())
    assert rc == 1 and not (books / "lathi" / "book.pdf").exists()
    assert not list((books / "lathi").glob("*.part"))


def test_a_matching_file_is_not_downloaded_again(tmp_path):
    books = _books(tmp_path)
    (books / "lathi" / "book.pdf").write_bytes(DATA)

    def boom(req, timeout=None):
        raise AssertionError("must not download")

    assert fpb.main(["--books-dir", str(books), "--required"], env={"BOOKS_FETCH_TOKEN": "t"}, urlopen=boom) == 0


def test_a_missing_token_fails_only_when_required(tmp_path, capsys):
    books = _books(tmp_path)
    assert fpb.main(["--books-dir", str(books), "--required"], env={}, urlopen=_opener()) == 1
    assert "BOOKS_FETCH_TOKEN" in capsys.readouterr().err
    assert fpb.main(["--books-dir", str(books)], env={}, urlopen=_opener()) == 0


def test_the_request_pins_the_ref_and_authenticates(tmp_path):
    books, seen = _books(tmp_path), []
    fpb.main(["--books-dir", str(books)], env={"BOOKS_FETCH_TOKEN": "secret"}, urlopen=_opener(seen=seen))
    req = seen[0]
    assert req.full_url == "https://api.github.com/repos/owner/private-books/contents/lathi/book.pdf?ref=" + "a" * 40
    assert req.get_header("Authorization") == "Bearer secret"
    assert req.get_header("Accept") == "application/vnd.github.raw+json"


def test_http_errors_fail_the_build_with_a_hint(tmp_path, capsys):
    books = _books(tmp_path)

    def denied(req, timeout=None):
        raise urllib.error.HTTPError(req.full_url, 404, "Not Found", {}, None)

    assert fpb.main(["--books-dir", str(books), "--required"], env={"BOOKS_FETCH_TOKEN": "t"}, urlopen=denied) == 1
    err = capsys.readouterr().err
    assert "404" in err and "BOOKS_FETCH_TOKEN" in err


def test_a_truncated_download_fails_cleanly_and_leaves_no_file(tmp_path, capsys):
    books = _books(tmp_path)

    class _TruncatedResponse:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self, size=-1):
            raise http.client.IncompleteRead(b"partial")

    def fake(req, timeout=None):
        return _TruncatedResponse()

    rc = fpb.main(["--books-dir", str(books), "--required"], env={"BOOKS_FETCH_TOKEN": "t"}, urlopen=fake)
    assert rc == 1
    err = capsys.readouterr().err
    assert "[books] lathi: FAILED:" in err
    assert not (books / "lathi" / "book.pdf").exists()
    assert not list((books / "lathi").glob("*.part"))


def test_a_stale_pdf_without_a_token_is_named_stale_not_missing(tmp_path, capsys):
    books = _books(tmp_path)
    stale = b"stale content that does not match the pinned sha256"
    (books / "lathi" / "book.pdf").write_bytes(stale)

    rc = fpb.main(["--books-dir", str(books)], env={}, urlopen=_opener())
    out = capsys.readouterr().out
    assert rc == 0
    assert "does not match" in out
    assert (books / "lathi" / "book.pdf").read_bytes() == stale

    rc2 = fpb.main(["--books-dir", str(books), "--required"], env={}, urlopen=_opener())
    assert rc2 == 1
