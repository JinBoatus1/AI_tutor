from __future__ import annotations

import json
import sys
import types
from pathlib import Path

from fastapi.testclient import TestClient


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class _FakeMongoClient:
    """Enough for importing backend.main when pymongo is not installed."""

    def __init__(self, *_args, **_kwargs) -> None:
        self.admin = self

    def __getitem__(self, _name: str):
        return {}

    def command(self, *_args, **_kwargs) -> None:
        return None


if "pymongo" not in sys.modules:
    fake_pymongo = types.ModuleType("pymongo")
    fake_pymongo.MongoClient = _FakeMongoClient
    sys.modules["pymongo"] = fake_pymongo

if "bson" not in sys.modules:
    fake_bson = types.ModuleType("bson")
    fake_bson.ObjectId = str
    sys.modules["bson"] = fake_bson

if "firebase_admin" not in sys.modules:
    fake_firebase_admin = types.ModuleType("firebase_admin")
    fake_firebase_auth = types.ModuleType("firebase_admin.auth")
    fake_firebase_credentials = types.ModuleType("firebase_admin.credentials")

    def _initialize_app(*_args, **_kwargs) -> None:
        return None

    def _verify_id_token(_token: str) -> dict[str, str]:
        return {}

    class _Certificate:
        def __init__(self, *_args, **_kwargs) -> None:
            pass

    fake_firebase_admin.initialize_app = _initialize_app
    fake_firebase_auth.verify_id_token = _verify_id_token
    fake_firebase_credentials.Certificate = _Certificate
    fake_firebase_admin.auth = fake_firebase_auth
    fake_firebase_admin.credentials = fake_firebase_credentials
    sys.modules["firebase_admin"] = fake_firebase_admin
    sys.modules["firebase_admin.auth"] = fake_firebase_auth
    sys.modules["firebase_admin.credentials"] = fake_firebase_credentials

from main import app


def main() -> None:
    test_dir = CURRENT_DIR / "test_pdfs"
    with TestClient(app) as client:
        with (test_dir / "Q5Q6.jpg").open("rb") as question_file, (test_dir / "Answer.jpg").open("rb") as answer_file:
            response = client.post(
                "/api/autograder/grade",
                data={"paper_id": "http-api-q5q6"},
                files={
                    "question_file": ("Q5Q6.jpg", question_file, "image/jpeg"),
                    "answer_file": ("Answer.jpg", answer_file, "image/jpeg"),
                },
            )

    print(response.status_code)
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
