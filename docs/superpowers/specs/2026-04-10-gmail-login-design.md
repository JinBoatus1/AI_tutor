# Gmail Login System Design

## Summary

Add Google (Gmail) login to the AI Tutor app using Firebase Auth for authentication and MongoDB Atlas for per-user data persistence. Users can use the app without logging in, but chat history and learning progress are only saved for logged-in users.

## Architecture

```
Browser
  ├── Firebase Auth SDK → Google login → ID token
  ├── Requests carry token in Authorization header
  └── Backend verifies token → uses email as user ID → reads/writes MongoDB

Firebase Auth  — authentication only ("who are you")
MongoDB Atlas  — data storage (chat history + learning bars)
FastAPI backend — token verification + business logic
React frontend — login UI + token management
```

## Database Design (MongoDB Atlas)

Two collections in a database named `aitutor`:

### `chat_sessions`

```json
{
  "_id": "ObjectId",
  "user_email": "student@gmail.com",
  "title": "5.2 Induction and Well-ordering",
  "created_at": "2026-04-10T...",
  "updated_at": "2026-04-10T...",
  "messages": [
    { "sender": "user", "text": "...", "ts": "..." },
    { "sender": "ai", "text": "...", "ts": "..." }
  ]
}
```

- One document per conversation session
- `title` is auto-generated from the first exchange topic
- `user_email` is the primary key for querying a user's sessions

### `learning_bars`

```json
{
  "_id": "ObjectId",
  "user_email": "student@gmail.com",
  "subject": "focs",
  "bars": { }
}
```

- Mirrors the existing `student_bar_store` data structure
- One document per user per subject

## Frontend Changes

### New files

- `src/context/AuthContext.tsx` — global auth state provider
  - Exposes: `user` (email, name, avatar) or `null`, `token`, `login()`, `logout()`
  - Wraps the app in `<AuthProvider>`
- `src/firebase.ts` — Firebase config and initialization

### Navbar (App.tsx)

- Not logged in: "Sign in with Google" button on the right side
- Logged in: user avatar + name + "Sign out" button
- Not logged in: a banner at the top: "Sign in to save your chat history and learning progress"

### Learning Model page (LearningModel.tsx)

- Not logged in: works as-is, no data saved
- Logged in:
  - Left sidebar: list of past chat sessions (title + date)
  - Click a session to load and continue it
  - "New Chat" button to start a fresh conversation
  - Each exchange auto-saves to MongoDB

### My Learning Bar page (MyLearningBar.tsx)

- Not logged in: shows "Please sign in to view your learning progress"
- Logged in: reads progress from MongoDB instead of local files

### Auto Grader page (AutoGrader.tsx)

- No changes. Unrelated to login.

## Backend Changes

### New files

- `backend/auth.py` — Firebase token verification
  - Reads `Authorization: Bearer <token>` header
  - Returns user email on success, `None` for anonymous
  - Not enforced globally — anonymous users can still call chat endpoint
- `backend/database.py` — MongoDB connection
  - Connects via `MONGODB_URI` environment variable
  - Establishes connection at startup, reuses globally

### API route changes (api_routes.py)

Modified endpoint:

- `POST /chat` — add optional `session_id` parameter
  - Logged in + session_id: load history from MongoDB, append new exchange, save
  - Logged in + no session_id: create new session in MongoDB
  - Not logged in: works as-is, no persistence

New endpoints:

- `GET /sessions` — list current user's chat sessions (title + date)
- `GET /sessions/{id}` — get full messages of a session
- `DELETE /sessions/{id}` — delete a session

### Learning bar changes (student_bar_store.py)

- When user is logged in: read/write from MongoDB instead of local files
- When not logged in: no learning bar functionality

## Environment Variables

| Platform | Variable | Purpose |
|----------|----------|---------|
| Vercel | `VITE_FIREBASE_API_KEY` | Firebase frontend config |
| Vercel | `VITE_FIREBASE_AUTH_DOMAIN` | Firebase frontend config |
| Vercel | `VITE_FIREBASE_PROJECT_ID` | Firebase frontend config |
| Render | `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin SDK service account JSON |
| Render | `MONGODB_URI` | MongoDB Atlas connection string |

## Setup Steps (before implementation)

1. **Firebase Console**: create project, enable Google sign-in provider
2. **MongoDB Atlas**: create free cluster, create database user, whitelist Render IP (or 0.0.0.0/0 for free tier)
3. **Vercel**: add VITE_FIREBASE_* environment variables
4. **Render**: add FIREBASE_SERVICE_ACCOUNT and MONGODB_URI environment variables

## Dependencies

Frontend (npm):
- `firebase` — Firebase Auth SDK

Backend (pip):
- `firebase-admin` — token verification
- `pymongo` — MongoDB driver

## Scope Boundaries

**In scope:**
- Google login/logout
- Chat history persistence per user
- Learning bar persistence per user
- Chat session list and continuation

**Out of scope:**
- User roles / admin panel
- Email/password login (Gmail only)
- Data migration from existing local files
- Chat export/sharing
