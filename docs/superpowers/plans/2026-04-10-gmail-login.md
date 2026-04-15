# Gmail Login + MongoDB Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google (Gmail) login via Firebase Auth and persist chat history + learning bars to MongoDB Atlas, replacing local file storage.

**Architecture:** Firebase Auth handles Google login on the frontend, issuing ID tokens that the FastAPI backend verifies. MongoDB Atlas stores per-user chat sessions and learning progress. Unauthenticated users can still chat but nothing is saved.

**Tech Stack:** Firebase Auth SDK (frontend), firebase-admin (backend), pymongo (backend), MongoDB Atlas (cloud DB), React Context (auth state)

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `frontend/src/firebase.ts` | Firebase app init + auth instance |
| `frontend/src/context/AuthContext.tsx` | Global auth state provider (user, token, login/logout) |
| `frontend/src/ChatHistory.tsx` | Left sidebar: list of past chat sessions |
| `frontend/src/ChatHistory.css` | Styles for chat history sidebar |
| `backend/auth.py` | Firebase token verification helper |
| `backend/database.py` | MongoDB connection + collection accessors |

### Modified files
| File | Changes |
|------|---------|
| `frontend/package.json` | Add `firebase` dependency |
| `frontend/src/main.tsx` | Wrap app with `<AuthProvider>` |
| `frontend/src/App.tsx` | Add login/logout button to navbar, add sign-in banner |
| `frontend/src/App.css` | Styles for auth navbar elements + banner |
| `frontend/src/LearningModel.tsx` | Add session management, chat history sidebar, auto-save |
| `frontend/src/Chat.css` | Styles for history sidebar in learning page |
| `frontend/src/MyLearningBar.tsx` | Use auth context, fetch from MongoDB when logged in |
| `backend/requirements.txt` | Add `firebase-admin`, `pymongo` |
| `backend/main.py` | Init MongoDB on startup |
| `backend/api_routes.py` | Add auth dependency, session endpoints, modify `/chat` |
| `backend/student_bar_store.py` | Add MongoDB read/write path alongside file path |

---

## Task 1: Firebase Frontend Setup

**Files:**
- Create: `frontend/src/firebase.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/src/vite-env.d.ts`

- [ ] **Step 1: Install firebase**

```bash
cd frontend && npm install firebase
```

- [ ] **Step 2: Create `frontend/src/firebase.ts`**

```typescript
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/firebase.ts
git commit -m "feat: add Firebase SDK and config"
```

---

## Task 2: Auth Context

**Files:**
- Create: `frontend/src/context/AuthContext.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create `frontend/src/context/AuthContext.tsx`**

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

interface AuthUser {
  email: string;
  displayName: string | null;
  photoURL: string | null;
  uid: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        setUser({
          email: firebaseUser.email || "",
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          uid: firebaseUser.uid,
        });
        setToken(idToken);
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
```

- [ ] **Step 2: Wrap app with AuthProvider in `main.tsx`**

Replace the contents of `frontend/src/main.tsx` with:

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { CurriculumProvider } from "./context/CurriculumContext";
import { AuthProvider } from "./context/AuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <CurriculumProvider>
        <App />
      </CurriculumProvider>
    </AuthProvider>
  </StrictMode>
);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/context/AuthContext.tsx frontend/src/main.tsx
git commit -m "feat: add AuthContext with Google login/logout"
```

---

## Task 3: Navbar Login UI

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Update `App.tsx` to show login/logout in navbar + sign-in banner**

Replace the contents of `frontend/src/App.tsx` with:

```typescript
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./Home";
import AutoGrader from "./AutoGrader";
import LearningModel from "./LearningModel";
import MyLearningBar from "./MyLearningBar";
import { useAuth } from "./context/AuthContext";

import "./App.css";

function App() {
  const { user, loading, login, logout } = useAuth();

  return (
    <Router>
      <div className="app-container">
        {!loading && !user && (
          <div className="auth-banner">
            Sign in to save your chat history and learning progress.
            <button className="auth-banner-btn" onClick={login}>Sign in</button>
          </div>
        )}
        <nav className="navbar">
          <h2 className="navbar-brand">Equal Education for Everyone</h2>
          <div className="nav-buttons">
            <Link to="/" className="btn-nav">Home</Link>
            <Link to="/autograder" className="btn-nav">Auto Grader</Link>
            <Link to="/learning" className="btn-nav btn-nav--learning">Learning Model</Link>
            <Link to="/learning-bar" className="btn-nav">My Learning bar</Link>
          </div>
          <div className="nav-auth">
            {loading ? null : user ? (
              <div className="nav-user">
                {user.photoURL && (
                  <img src={user.photoURL} alt="" className="nav-user-avatar" referrerPolicy="no-referrer" />
                )}
                <span className="nav-user-name">{user.displayName || user.email}</span>
                <button className="btn-nav btn-nav--logout" onClick={logout}>Sign out</button>
              </div>
            ) : (
              <button className="btn-nav btn-nav--login" onClick={login}>Sign in with Google</button>
            )}
          </div>
        </nav>

        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/autograder" element={<AutoGrader />} />
            <Route path="/learning" element={<LearningModel />} />
            <Route path="/learning-bar" element={<MyLearningBar />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
```

- [ ] **Step 2: Add auth styles to `App.css`**

Append the following to the end of `frontend/src/App.css`:

```css
/* Auth banner */
.auth-banner {
  background: #0d9488;
  color: #fff;
  text-align: center;
  padding: 8px 16px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.auth-banner-btn {
  background: #fff;
  color: #0d9488;
  border: none;
  border-radius: 6px;
  padding: 4px 14px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
}
.auth-banner-btn:hover {
  background: #f0fdfa;
}

/* Nav auth section */
.nav-auth {
  display: flex;
  align-items: center;
  margin-left: auto;
}
.nav-user {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nav-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}
.nav-user-name {
  color: #e2e8f0;
  font-size: 0.85rem;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-nav--login {
  background: #0d9488;
  color: #fff;
  border-radius: 6px;
  padding: 6px 14px;
  font-weight: 600;
}
.btn-nav--login:hover {
  background: #14b8a6;
}
.btn-nav--logout {
  font-size: 0.8rem;
  opacity: 0.8;
}
.btn-nav--logout:hover {
  opacity: 1;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.css
git commit -m "feat: add Google login/logout button and sign-in banner to navbar"
```

---

## Task 4: Backend — MongoDB Connection

**Files:**
- Create: `backend/database.py`
- Modify: `backend/requirements.txt`
- Modify: `backend/main.py`

- [ ] **Step 1: Add dependencies to `backend/requirements.txt`**

Append these lines to the end of `backend/requirements.txt`:

```
firebase-admin>=6.0.0
pymongo>=4.6.0
```

- [ ] **Step 2: Create `backend/database.py`**

```python
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
```

- [ ] **Step 3: Init MongoDB on app startup in `backend/main.py`**

Replace the contents of `backend/main.py` with:

```python
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_routes import router as api_router
import database


app = FastAPI()

origins = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    try:
        database.init_db()
    except Exception as e:
        print(f"[DB] MongoDB init failed: {e}", flush=True)


app.include_router(api_router)


@app.get("/")
async def root():
    return {"status": "ok", "msg": "AI Tutor backend running"}
```

- [ ] **Step 4: Commit**

```bash
git add backend/database.py backend/requirements.txt backend/main.py
git commit -m "feat: add MongoDB connection module and init on startup"
```

---

## Task 5: Backend — Firebase Token Verification

**Files:**
- Create: `backend/auth.py`

- [ ] **Step 1: Create `backend/auth.py`**

```python
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
    except Exception:
        return None
```

- [ ] **Step 2: Commit**

```bash
git add backend/auth.py
git commit -m "feat: add Firebase token verification module"
```

---

## Task 6: Backend — Chat Session Endpoints

**Files:**
- Modify: `backend/api_routes.py`

- [ ] **Step 1: Add imports and auth dependency at the top of `api_routes.py`**

After the existing imports (line 11), add:

```python
from fastapi import Header
from bson import ObjectId
from datetime import datetime, timezone

from auth import verify_token
import database
```

- [ ] **Step 2: Add session CRUD endpoints**

Add the following after the existing `put_student_bar` endpoint (after line 536):

```python
# ============================================================
# Chat session endpoints (requires auth)
# ============================================================

@router.get("/api/sessions")
async def list_sessions(authorization: Optional[str] = Header(None)):
    email = verify_token(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    col = database.chat_sessions()
    if col is None:
        return []
    cursor = col.find(
        {"user_email": email},
        {"messages": 0},  # exclude messages for list view
    ).sort("updated_at", -1)
    sessions = []
    for doc in cursor:
        sessions.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", "Untitled"),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
        })
    return sessions


@router.get("/api/sessions/{session_id}")
async def get_session(session_id: str, authorization: Optional[str] = Header(None)):
    email = verify_token(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    col = database.chat_sessions()
    if col is None:
        raise HTTPException(status_code=503, detail="Database not available")
    doc = col.find_one({"_id": ObjectId(session_id), "user_email": email})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", "Untitled"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "messages": doc.get("messages", []),
    }


@router.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, authorization: Optional[str] = Header(None)):
    email = verify_token(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    col = database.chat_sessions()
    if col is None:
        raise HTTPException(status_code=503, detail="Database not available")
    result = col.delete_one({"_id": ObjectId(session_id), "user_email": email})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}
```

- [ ] **Step 3: Modify the `/api/chat` endpoint to support session persistence**

Update the `ChatMessage` model (around line 136) to add `session_id`:

```python
class ChatMessage(BaseModel):
    message: str
    history: List[dict] = []
    images_b64: Optional[List[str]] = None
    pdf_b64: Optional[str] = None
    student_id: Optional[str] = None
    session_id: Optional[str] = None
```

At the beginning of the `chat` function (after `student_id = ...` around line 223), add session loading:

```python
    # Load session history from MongoDB if authenticated with session_id
    user_email = verify_token(chat_message.student_id)  # Will be replaced with header auth below
    # Actually, we need the Authorization header. Add it as parameter:
```

Actually, we need to change the endpoint signature. Replace the `chat` function signature (line 220) with:

```python
@router.post("/api/chat")
async def chat(chat_message: ChatMessage, authorization: Optional[str] = Header(None)):
```

Then after `student_id = chat_message.student_id or "default_student"` (line 223), add:

```python
    user_email = verify_token(authorization)
```

At the end of the `chat` function, before the final `return result` (line 503-504), add session save logic:

```python
    # Save to MongoDB if user is authenticated
    if user_email:
        col = database.chat_sessions()
        if col is not None:
            now = datetime.now(timezone.utc).isoformat()
            new_msg_pair = [
                {"sender": "user", "text": chat_message.message, "ts": now},
                {"sender": "ai", "text": answer, "ts": now},
            ]
            if chat_message.session_id:
                # Append to existing session
                try:
                    col.update_one(
                        {"_id": ObjectId(chat_message.session_id), "user_email": user_email},
                        {
                            "$push": {"messages": {"$each": new_msg_pair}},
                            "$set": {"updated_at": now},
                        },
                    )
                except Exception as e:
                    print(f"[DB] session update failed: {e}", flush=True)
            else:
                # Create new session
                try:
                    title = chat_message.message[:80]
                    doc = col.insert_one({
                        "user_email": user_email,
                        "title": title,
                        "created_at": now,
                        "updated_at": now,
                        "messages": new_msg_pair,
                    })
                    result["session_id"] = str(doc.inserted_id)
                except Exception as e:
                    print(f"[DB] session create failed: {e}", flush=True)

    print("[Chat] response sent", flush=True)
    return result
```

Note: Remove the existing `print("[Chat] response sent", flush=True)` and `return result` at the end — they're now included in the block above.

- [ ] **Step 4: Commit**

```bash
git add backend/api_routes.py
git commit -m "feat: add chat session CRUD endpoints and persistence"
```

---

## Task 7: Backend — Learning Bar MongoDB Storage

**Files:**
- Modify: `backend/student_bar_store.py`
- Modify: `backend/api_routes.py`

- [ ] **Step 1: Add MongoDB methods to `student_bar_store.py`**

Add these imports at the top of `backend/student_bar_store.py` (after line 9):

```python
import database
```

Add these functions after the existing `save_bar` function (after line 72):

```python
def load_bar_mongo(user_email: str) -> Dict[str, Any]:
    """Load learning bar from MongoDB for a logged-in user."""
    col = database.learning_bars()
    if col is None:
        return _empty_bar(user_email)
    doc = col.find_one({"user_email": user_email, "subject": "focs"})
    if not doc:
        return _empty_bar(user_email)
    bar = dict(doc)
    bar.pop("_id", None)
    bar.pop("user_email", None)
    bar.pop("subject", None)
    bar.setdefault("student_id", user_email)
    bar.setdefault("current_section", None)
    bar.setdefault("learned_sections", [])
    bar.setdefault("planned_sections", [])
    bar.setdefault("confusion_counts", {})
    bar.setdefault("updated_at", _now_iso())
    return bar


def save_bar_mongo(user_email: str, bar: Dict[str, Any]) -> None:
    """Save learning bar to MongoDB for a logged-in user."""
    col = database.learning_bars()
    if col is None:
        return
    bar["updated_at"] = _now_iso()
    doc = {k: v for k, v in bar.items() if k not in ("_id",)}
    doc["user_email"] = user_email
    doc["subject"] = "focs"
    col.update_one(
        {"user_email": user_email, "subject": "focs"},
        {"$set": doc},
        upsert=True,
    )
```

- [ ] **Step 2: Update learning bar API routes to use auth**

In `backend/api_routes.py`, update the `get_student_bar` and `put_student_bar` endpoints:

Replace the `get_student_bar` endpoint with:

```python
@router.get("/api/student_bar")
async def get_student_bar(
    student_id: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    email = verify_token(authorization)
    if email:
        return sbs.load_bar_mongo(email)
    sid = student_id or "default_student"
    return sbs.load_bar(sid)
```

Replace the `put_student_bar` endpoint with:

```python
@router.put("/api/student_bar")
async def put_student_bar(body: StudentBarUpdate, authorization: Optional[str] = Header(None)):
    email = verify_token(authorization)
    if email:
        bar = sbs.load_bar_mongo(email)
        bar["learned_sections"] = sorted(
            set(body.learned_sections),
            key=lambda x: tuple(int(p) for p in str(x).split(".")),
        )
        sbs.save_bar_mongo(email, bar)
        return bar
    sid = body.student_id or "default_student"
    bar = sbs.load_bar(sid)
    bar["learned_sections"] = sorted(
        set(body.learned_sections),
        key=lambda x: tuple(int(p) for p in str(x).split(".")),
    )
    sbs.save_bar(sid, bar)
    return bar
```

Also update `update_bar_from_message` call in the chat endpoint: in the existing chat function, find the line `bar = sbs.update_bar_from_message(student_id, chat_message.message)` and wrap it to use MongoDB when authenticated:

```python
    try:
        if user_email:
            bar = sbs.load_bar_mongo(user_email)
            # Run the same heuristic update logic
            bar = sbs.update_bar_from_message_on_bar(bar, chat_message.message)
            sbs.save_bar_mongo(user_email, bar)
        else:
            bar = sbs.update_bar_from_message(student_id, chat_message.message)
        system_content += sbs.build_bar_prompt(bar)
    except Exception as e:
        print(f"[StudentBar] update failed: {e}")
```

Add this helper function in `student_bar_store.py` after the `update_bar_from_message` function:

```python
def update_bar_from_message_on_bar(bar: Dict[str, Any], message: str) -> Dict[str, Any]:
    """Same heuristic update as update_bar_from_message but operates on an existing bar dict (no file I/O)."""
    token_map = _load_tree_token_map()
    valid = set(token_map.keys())
    msg = (message or "").strip()
    tokens = _extract_section_tokens(msg, valid)
    msg_lower = msg.lower()

    learned_kw = [
        "学过", "已经学", "学完了", "学会", "掌握", "finished", "completed",
        "already learned", "already learnt", "have learned", "have learnt",
        "have done", "i've done", "ive done", "done with", "mastered",
        "covered", "learned", "learnt", "reached", "up to",
        "through section", "through ch", "through chapter", "as far as",
    ]
    current_kw = [
        "目前", "现在", "学到", "i'm at", "im at", "currently",
        "currently at", "so far", "right now", "stuck at", "working on",
    ]
    planned_kw = [
        "想学", "要学", "next", "plan to learn", "want to study",
        "study now", "review", "复习",
    ]
    confusion_kw = [
        "不懂", "没懂", "看不懂", "不会", "卡住", "confused",
        "don't understand", "cannot solve", "stuck",
    ]
    past_through_chapter_kw = [
        "学到", "学过", "学完了", "已经学", "finished", "completed",
        "learned", "learnt", "reached", "up to", "through chapter",
        "through ch", "mastered", "covered", "have learned", "have learnt",
        "have done", "as far as", "done with", "already learned", "already learnt",
    ]
    future_study_kw = [
        "want to learn", "want to study", "要学", "想学",
        "will study", "going to study",
    ]
    has_past_through = _contains_any(msg, past_through_chapter_kw)
    wants_only_future = _contains_any(msg_lower, future_study_kw) and not re.search(
        r"(?i)(finished|completed|学到|学过|学完了|reached|have\s+learned|have\s+learnt|up\s+to|through\s+ch)",
        msg,
    )
    should_apply_through = has_past_through and not wants_only_future

    explicit_chapters = _extract_explicit_chapter_numbers(msg)
    if explicit_chapters and should_apply_through:
        n_through = max(explicit_chapters)
        _apply_learned_through_chapter_n(bar, n_through, valid)

    subsection_hits = _extract_subsection_tokens(msg, valid)
    if subsection_hits and should_apply_through:
        ordered = _ordered_section_tokens_preorder()
        in_order = [t for t in subsection_hits if t in ordered]
        if in_order:
            target_sub = max(in_order, key=lambda t: ordered.index(t))
            _apply_learned_through_subsection(bar, target_sub, valid, ordered)

    if tokens and _contains_any(msg, learned_kw):
        learned_set = set(bar.get("learned_sections") or [])
        for t in tokens:
            learned_set.add(t)
        bar["learned_sections"] = sorted(learned_set, key=lambda x: tuple(int(p) for p in x.split(".")))

    if tokens and _contains_any(msg, current_kw):
        bar["current_section"] = tokens[-1]

    if tokens and _contains_any(msg, planned_kw):
        planned = set(bar.get("planned_sections") or [])
        for t in tokens:
            planned.add(t)
        bar["planned_sections"] = sorted(planned, key=lambda x: tuple(int(p) for p in x.split(".")))

    if _contains_any(msg_lower, confusion_kw):
        confusion_counts = bar.get("confusion_counts") or {}
        targets = tokens[:] if tokens else ([bar.get("current_section")] if bar.get("current_section") else [])
        for t in targets:
            if not t:
                continue
            confusion_counts[t] = int(confusion_counts.get(t, 0)) + 1
        bar["confusion_counts"] = confusion_counts

    return bar
```

- [ ] **Step 3: Commit**

```bash
git add backend/student_bar_store.py backend/api_routes.py
git commit -m "feat: add MongoDB path for learning bar read/write"
```

---

## Task 8: Frontend — Chat History Sidebar

**Files:**
- Create: `frontend/src/ChatHistory.tsx`
- Create: `frontend/src/ChatHistory.css`

- [ ] **Step 1: Create `frontend/src/ChatHistory.css`**

```css
.chat-history-sidebar {
  display: flex;
  flex-direction: column;
  width: 260px;
  min-width: 200px;
  border-right: 1px solid #1e293b;
  background: #0f172a;
  height: 100%;
  overflow: hidden;
}
.chat-history-header {
  padding: 12px 14px;
  border-bottom: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.chat-history-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.chat-history-new-btn {
  background: #0d9488;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.8rem;
  cursor: pointer;
  font-weight: 600;
}
.chat-history-new-btn:hover {
  background: #14b8a6;
}
.chat-history-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}
.chat-history-item {
  padding: 10px 14px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.15s;
}
.chat-history-item:hover {
  background: #1e293b;
}
.chat-history-item--active {
  background: #1e293b;
  border-left-color: #14b8a6;
}
.chat-history-item-title {
  font-size: 0.85rem;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chat-history-item-date {
  font-size: 0.7rem;
  color: #64748b;
  margin-top: 2px;
}
.chat-history-item-delete {
  float: right;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0 4px;
}
.chat-history-item-delete:hover {
  color: #ef4444;
}
.chat-history-empty {
  padding: 20px 14px;
  color: #64748b;
  font-size: 0.85rem;
  text-align: center;
}
```

- [ ] **Step 2: Create `frontend/src/ChatHistory.tsx`**

```typescript
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./context/AuthContext";
import "./ChatHistory.css";

interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatHistoryProps {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  refreshTrigger: number;
}

const API = import.meta.env.VITE_API_URL;

export default function ChatHistory({
  activeSessionId,
  onSelectSession,
  onNewChat,
  refreshTrigger,
}: ChatHistoryProps) {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API}/api/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setSessions(data);
      }
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    }
  }, [token]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, refreshTrigger]);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!token) return;
    try {
      await fetch(`${API}/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        onNewChat();
      }
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="chat-history-sidebar">
      <div className="chat-history-header">
        <span className="chat-history-title">History</span>
        <button className="chat-history-new-btn" onClick={onNewChat}>
          + New
        </button>
      </div>
      <div className="chat-history-list">
        {sessions.length === 0 ? (
          <div className="chat-history-empty">No conversations yet</div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={`chat-history-item ${
                activeSessionId === s.id ? "chat-history-item--active" : ""
              }`}
              onClick={() => onSelectSession(s.id)}
            >
              <button
                className="chat-history-item-delete"
                onClick={(e) => handleDelete(e, s.id)}
                title="Delete"
              >
                x
              </button>
              <div className="chat-history-item-title">{s.title}</div>
              <div className="chat-history-item-date">
                {formatDate(s.updated_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/ChatHistory.tsx frontend/src/ChatHistory.css
git commit -m "feat: add ChatHistory sidebar component"
```

---

## Task 9: Frontend — Integrate Auth + Sessions into LearningModel

**Files:**
- Modify: `frontend/src/LearningModel.tsx`
- Modify: `frontend/src/Chat.css`

- [ ] **Step 1: Update `LearningModel.tsx`**

Add imports at the top (after existing imports):

```typescript
import { useAuth } from "./context/AuthContext";
import ChatHistory from "./ChatHistory";
```

Inside the `LearningModel` component, add auth state and session management (after the existing `studentId` state):

```typescript
  const { user, token } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
```

Update the `handleSend` function to:
1. Include the `Authorization` header when `token` exists
2. Include `session_id` in the request body
3. Save the returned `session_id` for new sessions

In the `handleSend` function, replace the `fetch` call (around line 219-230) with:

```typescript
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: displayMessage,
          history: messages,
          images_b64: imagesB64,
          pdf_b64: hasPdf ? pdfSnapshot!.dataUrl : undefined,
          student_id: studentId,
          session_id: sessionId,
        }),
        signal: controller.signal,
      });
```

After `data = await resp.json();` add:

```typescript
      // Track session ID for subsequent messages
      if (data?.session_id && !sessionId) {
        setSessionId(data.session_id);
        setRefreshTrigger((n) => n + 1);
      }
```

Update the `reset` function to also clear the session:

```typescript
  const reset = () => {
    setMessages([{ sender: "ai", text: WELCOME_MSG }]);
    setSessionId(null);
    setMatchedSection(null);
    setDataMatchedTopic(null);
    setReferencePageImage(null);
    setReferencePageSnippets(null);
    setReferenceSectionPages(null);
    setSectionPageIndex(0);
    setEnlargedImageSrc(null);
    setPdfAttachment(null);
    setIsAwaitingReply(false);
  };
```

Add a `loadSession` handler and `onNewChat` handler:

```typescript
  const loadSession = async (sid: string) => {
    if (!token) return;
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/sessions/${sid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const msgs = (data.messages || []).map((m: any) => ({
        sender: m.sender,
        text: m.text,
      }));
      setMessages(msgs.length > 0 ? msgs : [{ sender: "ai", text: WELCOME_MSG }]);
      setSessionId(sid);
      setMatchedSection(null);
      setDataMatchedTopic(null);
      setReferencePageImage(null);
      setReferencePageSnippets(null);
      setReferenceSectionPages(null);
      setSectionPageIndex(0);
    } catch (e) {
      console.error("Failed to load session", e);
    }
  };

  const handleNewChat = () => {
    reset();
    setRefreshTrigger((n) => n + 1);
  };
```

In the JSX return, wrap the layout to include the sidebar when user is logged in. Replace the outermost `<div className="learning-page-wrapper">` with:

```tsx
  return (
    <div className="learning-page-wrapper">
      {user && (
        <ChatHistory
          activeSessionId={sessionId}
          onSelectSession={loadSession}
          onNewChat={handleNewChat}
          refreshTrigger={refreshTrigger}
        />
      )}
    <div className="learning-layout" ref={layoutRef}>
    {/* ... rest of existing JSX unchanged ... */}
    </div>
    {/* ... lightbox unchanged ... */}
    </div>
  );
```

- [ ] **Step 2: Add sidebar layout styles to `Chat.css`**

Append to the end of `frontend/src/Chat.css`:

```css
/* Learning page with sidebar */
.learning-page-wrapper {
  display: flex;
  height: 100%;
  overflow: hidden;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/LearningModel.tsx frontend/src/Chat.css
git commit -m "feat: integrate auth and session management into LearningModel"
```

---

## Task 10: Frontend — Update MyLearningBar for Auth

**Files:**
- Modify: `frontend/src/MyLearningBar.tsx`

- [ ] **Step 1: Update `MyLearningBar.tsx` to use auth**

Add auth import at the top:

```typescript
import { useAuth } from "./context/AuthContext";
```

Replace the hardcoded `API` constant (line 5) with:

```typescript
const API = import.meta.env.VITE_API_URL;
```

Inside the `MyLearningBar` component, add auth context (after the existing `studentId` state):

```typescript
  const { user, token } = useAuth();
```

Update the `load` callback to include auth header:

```typescript
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const [tRes, bRes] = await Promise.all([
        fetch(`${API}/api/focs_tree`),
        fetch(
          `${API}/api/student_bar?student_id=${encodeURIComponent(studentId)}`,
          { headers }
        ),
      ]);
      if (!tRes.ok) throw new Error("Failed to load FOCS tree.");
      if (!bRes.ok) throw new Error("Failed to load learning bar.");
      const tJson = (await tRes.json()) as FocsNode;
      const bJson = (await bRes.json()) as { learned_sections?: string[] };
      setTree(tJson);
      setLearned(Array.isArray(bJson.learned_sections) ? bJson.learned_sections : []);
    } catch (e) {
      setError((e as Error).message || "Network error.");
      setTree(null);
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);
```

Update the `persistLearned` callback to include auth header:

```typescript
  const persistLearned = useCallback(
    async (next: string[]) => {
      setSaving(true);
      setError(null);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const resp = await fetch(`${API}/api/student_bar`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            student_id: studentId,
            learned_sections: next,
          }),
        });
        if (!resp.ok) {
          const d = await resp.json().catch(() => ({}));
          throw new Error(d.detail || "Save failed.");
        }
        const data = (await resp.json()) as { learned_sections?: string[] };
        setLearned(Array.isArray(data.learned_sections) ? data.learned_sections : next);
      } catch (e) {
        setError((e as Error).message || "Save failed.");
      } finally {
        setSaving(false);
      }
    },
    [studentId, token]
  );
```

Add a login prompt for unauthenticated users. In the JSX, before the existing `if (loading)` check, add:

```typescript
  if (!user) {
    return (
      <div className="my-learning-bar-page">
        <p className="my-learning-bar-status">
          Please sign in to view your learning progress.
        </p>
      </div>
    );
  }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/MyLearningBar.tsx
git commit -m "feat: update MyLearningBar to use auth and MongoDB"
```

---

## Task 11: Environment Variables and Local Testing

**Files:**
- No code changes; configuration only

- [ ] **Step 1: Create Firebase project**

1. Go to https://console.firebase.google.com
2. Create a new project (e.g. "ai-tutor")
3. Go to Authentication > Sign-in method > enable "Google"
4. Go to Project settings > General > scroll to "Your apps" > add a Web app
5. Copy the config values (apiKey, authDomain, projectId)
6. Go to Project settings > Service accounts > Generate new private key (download JSON)

- [ ] **Step 2: Create MongoDB Atlas cluster**

1. Go to https://cloud.mongodb.com
2. Create a free M0 cluster
3. Create a database user (username + password)
4. Network Access > Allow from anywhere (0.0.0.0/0) for free tier
5. Get the connection string: `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/aitutor`

- [ ] **Step 3: Set local environment variables**

Create `frontend/.env.local`:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_API_URL=http://127.0.0.1:8000
```

Add to `backend/.env`:

```
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/aitutor
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

- [ ] **Step 4: Install backend dependencies and test locally**

```bash
cd backend && pip install firebase-admin pymongo
```

```bash
cd backend && uvicorn main:app --reload
```

```bash
cd frontend && npm run dev
```

Verify:
- Backend starts and prints "[DB] Connected to MongoDB Atlas"
- Frontend loads, "Sign in with Google" button appears in navbar
- Clicking it opens Google login popup
- After login, name + avatar appear in navbar
- Chat messages get saved (check MongoDB Atlas UI)

- [ ] **Step 5: Commit .env files to gitignore if not already**

Check that `frontend/.env.local` and `backend/.env` are in `.gitignore`. If not, add them.

---

## Task 12: Deploy Environment Variables

**Files:**
- No code changes; platform configuration only

- [ ] **Step 1: Add Vercel environment variables**

Vercel dashboard > project > Settings > Environment Variables:

- `VITE_FIREBASE_API_KEY` = (from Firebase Console)
- `VITE_FIREBASE_AUTH_DOMAIN` = (from Firebase Console)
- `VITE_FIREBASE_PROJECT_ID` = (from Firebase Console)

- [ ] **Step 2: Add Render environment variables**

Render dashboard > service > Environment:

- `MONGODB_URI` = (from MongoDB Atlas)
- `FIREBASE_SERVICE_ACCOUNT` = (the entire service account JSON, as a single-line string)

- [ ] **Step 3: Add Firebase authorized domains**

Firebase Console > Authentication > Settings > Authorized domains:
- Add your Vercel production domain (e.g. `ai-tutor-xxx.vercel.app`)
- Add your custom domain if any

- [ ] **Step 4: Trigger redeploy and verify**

Push to trigger auto-deploy. Verify:
- Login works on production
- Chat sessions persist across page reloads
- Learning bar data persists for logged-in users
- Anonymous users can still chat without errors
