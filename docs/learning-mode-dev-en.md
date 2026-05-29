# Learning Mode — Developer / ops guide

For **developers and operators**: APIs, code map, deploy, troubleshooting. User-facing copy: [learning-mode-user-en.md](./learning-mode-user-en.md).

**中文版：** [learning-mode-dev.md](./learning-mode-dev.md)

---

## 1. Responsibilities

| Layer | Role |
|-------|------|
| `frontend/src/LearningModel.tsx` | Three-column layout, chat, `/api/chat`, preview, `/api/textbook_pages`, header book pages |
| `frontend/src/LearningBarPanel.tsx` | Outline tree, progress dots, textbook picker, sync |
| `backend/api_routes.py` | `/api/chat`, `/api/textbook_pages`, `matched_topic` fields, simple-definition early return, `GET /api/version` |

---

## 2. Key APIs

### `POST /api/chat`

Body fields include `message`, `history`, `student_id`, `session_id`, `textbook_id`, `images_b64`, `pdf_b64`, `silent` (see `ChatMessage` in `api_routes.py`).

**Simple-definition path:** if `_is_simple_definition_question` matches at the top of the handler, the route **returns early** with a one-sentence reply and skips topic matching, chapter-tree prompts, memory, bar updates, etc. (per current repo implementation).

**`matched_topic` (normal path):** should expose **book** pages (`start_book` / `end_book`) for UI alignment with the outline, and **PDF** pages (`start_pdf` / `end_pdf` or legacy `start` / `end` as PDF) for rendering.

### `GET /api/textbook_pages`

Query: `textbook_id`, `start_book`, `end_book`, `section_title`. Returns `pages_b64[]` and `matched_topic` with the same book/PDF split.

### `GET /api/version`

Deploy probe: e.g. `RENDER_GIT_COMMIT` when running on Render.

---

## 3. Frontend env

- **`VITE_API_URL`** (`frontend/src/apiBase.ts`): optional API base. Empty = same-origin `/api/...`. Avoid `http://` API on `https://` pages (mixed content).

---

## 4. Deploy (e.g. Render)

1. Push to GitHub.  
2. Trigger Render **Deploy** and wait for success.  
3. Hit `https://<service>/api/version` and confirm commit.  
4. In the browser, DevTools → Network → confirm `/api/chat` **Request URL** points at that service.

---

## 5. Troubleshooting

| Symptom | Checks |
|---------|--------|
| Pages never load | PDF on server, `/api/textbook_pages`, limits |
| Header pages vs tree mismatch | Both sides ship `start_book`/`end_book`; cache |
| Definition answers still long | Deployed `api_routes.py` includes early return; correct host |
| Wrong API | `VITE_API_URL` at build time; no stale localhost in prod |

---

## 6. Code pointers

- `frontend/src/LearningModel.tsx`  
- `frontend/src/LearningBarPanel.tsx`  
- `frontend/src/learningTextbooks.ts`  
- `backend/api_routes.py`  
- `backend/learning_resources.py`  

---

*Trust the repository source over this memo if they diverge.*
