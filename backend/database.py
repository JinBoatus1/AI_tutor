"""MongoDB Atlas connection and collection accessors."""

import os
from pymongo import MongoClient

_client: MongoClient | None = None
_db = None


def init_db() -> None:
    """Call once at app startup."""
    global _client, _db
    uri = os.getenv("MONGODB_URI")
    if not uri:
        print("[DB] MONGODB_URI not set — database features disabled", flush=True)
        return
    _client = MongoClient(uri)
    _db = _client["aitutor"]
    # Verify connection
    _client.admin.command("ping")
    print("[DB] Connected to MongoDB Atlas", flush=True)


def get_db():
    """Return the database instance, or None if not connected."""
    return _db


def chat_sessions():
    """Return the chat_sessions collection, or None."""
    return _db["chat_sessions"] if _db is not None else None


def learning_bars():
    """Return the learning_bars collection, or None."""
    return _db["learning_bars"] if _db is not None else None
