"""Tests for grade_store: Mongo-primary + file-fallback persistence.

Run: pytest test_grade_store.py   (from backend/)

Covers both branches without a real DB:
  - file fallback  -> database.grades() monkeypatched to None + GRADE_DIR redirected to tmp
  - mongo path      -> database.grades() monkeypatched to a fake in-memory collection
"""

import database
import grade_store as store


# --------------------------------------------------------------------------- #
# A tiny in-memory stand-in for a Mongo collection (find_one / update_one upsert / delete_one)
# --------------------------------------------------------------------------- #
class _Res:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count


class FakeCollection:
    def __init__(self):
        self.docs: list[dict] = []

    def _match(self, doc, flt):
        return all(doc.get(k) == v for k, v in flt.items())

    def find_one(self, flt):
        for d in self.docs:
            if self._match(d, flt):
                return dict(d)
        return None

    def update_one(self, flt, update, upsert=False):
        for d in self.docs:
            if self._match(d, flt):
                d.update(update["$set"])
                return
        if upsert:
            self.docs.append(dict(update["$set"]))

    def delete_one(self, flt):
        for i, d in enumerate(self.docs):
            if self._match(d, flt):
                del self.docs[i]
                return _Res(1)
        return _Res(0)


def _course():
    return {
        "name": "Discrete Math",
        "term": "Fall 2026",
        "categories": [
            {
                "id": "c1",
                "name": "Exams",
                "weight": 100,
                "rule": {"kind": "uniform", "nSlots": 2},
                "items": [{"id": "e1", "name": "E1", "score": 90, "maxScore": 100}],
            }
        ],
        "cutoffs": [{"letter": "A", "min": 90}],
    }


# --------------------------------------------------------------------------- #
# File fallback (db absent)
# --------------------------------------------------------------------------- #
def test_file_missing_returns_none(monkeypatch, tmp_path):
    monkeypatch.setattr(database, "grades", lambda: None)
    monkeypatch.setattr(store, "GRADE_DIR", str(tmp_path))
    assert store.load_course("a@b.com") is None


def test_file_save_then_load_round_trip(monkeypatch, tmp_path):
    monkeypatch.setattr(database, "grades", lambda: None)
    monkeypatch.setattr(store, "GRADE_DIR", str(tmp_path))
    store.save_course("a@b.com", _course())
    got = store.load_course("a@b.com")
    assert got is not None
    assert got["name"] == "Discrete Math"
    assert got["term"] == "Fall 2026"  # rich fields preserved verbatim
    assert got["categories"][0]["items"][0]["id"] == "e1"  # item id preserved
    assert "updated_at" in got


def test_file_save_stamps_updated_at_and_strips_storage_keys(monkeypatch, tmp_path):
    monkeypatch.setattr(database, "grades", lambda: None)
    monkeypatch.setattr(store, "GRADE_DIR", str(tmp_path))
    dirty = dict(_course(), _id="x", user_email="evil@b.com", course_id="hack")
    stored = store.save_course("a@b.com", dirty)
    assert "_id" not in stored and "user_email" not in stored and "course_id" not in stored
    assert "updated_at" in stored


def test_file_safe_email_path(monkeypatch, tmp_path):
    monkeypatch.setattr(database, "grades", lambda: None)
    monkeypatch.setattr(store, "GRADE_DIR", str(tmp_path))
    # slashes / spaces in an email-like id must not escape the dir
    p = store._grade_path("../../etc/pw d", "default")
    assert str(tmp_path) in p
    assert "/../" not in p.replace(str(tmp_path), "")


def test_file_delete(monkeypatch, tmp_path):
    monkeypatch.setattr(database, "grades", lambda: None)
    monkeypatch.setattr(store, "GRADE_DIR", str(tmp_path))
    store.save_course("a@b.com", _course())
    assert store.delete_course("a@b.com") is True
    assert store.load_course("a@b.com") is None
    assert store.delete_course("a@b.com") is False  # already gone


# --------------------------------------------------------------------------- #
# Mongo path (fake collection)
# --------------------------------------------------------------------------- #
def test_mongo_save_then_load(monkeypatch):
    fake = FakeCollection()
    monkeypatch.setattr(database, "grades", lambda: fake)
    store.save_course("a@b.com", _course())
    got = store.load_course("a@b.com")
    assert got is not None
    assert got["name"] == "Discrete Math"
    # storage keys are stripped from the returned body but present in the raw doc
    assert "user_email" not in got and "course_id" not in got
    assert fake.docs[0]["user_email"] == "a@b.com"
    assert fake.docs[0]["course_id"] == "default"


def test_mongo_upsert_updates_in_place(monkeypatch):
    fake = FakeCollection()
    monkeypatch.setattr(database, "grades", lambda: fake)
    store.save_course("a@b.com", _course())
    updated = dict(_course(), name="Renamed")
    store.save_course("a@b.com", updated)
    assert len(fake.docs) == 1  # not duplicated
    assert store.load_course("a@b.com")["name"] == "Renamed"


def test_mongo_isolates_by_user(monkeypatch):
    fake = FakeCollection()
    monkeypatch.setattr(database, "grades", lambda: fake)
    store.save_course("a@b.com", dict(_course(), name="A's course"))
    store.save_course("b@b.com", dict(_course(), name="B's course"))
    assert store.load_course("a@b.com")["name"] == "A's course"
    assert store.load_course("b@b.com")["name"] == "B's course"


def test_mongo_missing_returns_none(monkeypatch):
    fake = FakeCollection()
    monkeypatch.setattr(database, "grades", lambda: fake)
    assert store.load_course("nobody@b.com") is None


def test_mongo_delete(monkeypatch):
    fake = FakeCollection()
    monkeypatch.setattr(database, "grades", lambda: fake)
    store.save_course("a@b.com", _course())
    assert store.delete_course("a@b.com") is True
    assert store.load_course("a@b.com") is None
    assert store.delete_course("a@b.com") is False


def test_mongo_course_id_slot_keeps_multicourse_door_open(monkeypatch):
    fake = FakeCollection()
    monkeypatch.setattr(database, "grades", lambda: fake)
    store.save_course("a@b.com", dict(_course(), name="Default"), course_id="default")
    store.save_course("a@b.com", dict(_course(), name="Second"), course_id="course2")
    assert store.load_course("a@b.com", "default")["name"] == "Default"
    assert store.load_course("a@b.com", "course2")["name"] == "Second"
