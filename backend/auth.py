"""Firebase ID token verification for FastAPI."""

import json
import os
from typing import Optional

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

_initialized = False


def _ensure_init() -> bool:
    global _initialized
    if _initialized:
        return True
    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    if not sa_json:
        print("[Auth] FIREBASE_SERVICE_ACCOUNT not set — auth disabled", flush=True)
        return False
    try:
        sa_dict = json.loads(sa_json)
        cred = credentials.Certificate(sa_dict)
        firebase_admin.initialize_app(cred)
        _initialized = True
        print("[Auth] Firebase Admin initialized", flush=True)
        return True
    except Exception as e:
        print(f"[Auth] Firebase init failed: {e}", flush=True)
        return False


def verify_token(authorization: Optional[str]) -> Optional[str]:
    """
    Verify a Firebase ID token from the Authorization header.
    Returns the user's email on success, None on failure or missing token.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    if not _ensure_init():
        return None
    token = authorization[7:]
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded.get("email")
    except Exception as e:
        print(f"[Auth] Token verification failed: {e}", flush=True)
        return None
