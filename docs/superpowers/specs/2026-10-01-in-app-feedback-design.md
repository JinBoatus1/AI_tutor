# In-App Feedback: Design Spec

**Date:** 2026-10-01
**Status:** The design was approved in conversation, section by section, on 2026-10-01. This written spec is awaiting review. The implementation plan comes after it.
**Branch:** `feat/feedback-window`, from `function` at `153d090`.
**Depends on:** `fix/auth-token-refresh`, which keeps the signed-in token fresh (§5.3).

---

## 1. Goal

Today a student who finds a broken feature, a wrong page number or a confusing explanation in AI Tutor has no way to tell the team. This feature adds a feedback form inside the app:

- A signed-in student fills it in.
- The backend turns each report into an issue in a private GitHub repository that the team watches.
- Students never need a GitHub account, and nothing they write becomes public.

**Success criteria**

1. A signed-in student can send feedback from any page that shows the sidebar (every route except Home). A report sent from the textbook panel already names the book, section and page on screen.
2. Every report the student was told had been received still exists afterwards: as a GitHub issue, or as a MongoDB record if GitHub was unreachable.
3. A guest or signed-out visitor who clicks an entry point gets the sign-in modal instead of the form.
4. No new dependencies are added, and the GitHub token exists only in the backend's environment.

## 2. Decisions

These were made with the user on 2026-10-01.

| # | Decision | Why |
|---|---|---|
| D1 | The form goes to the backend, which opens an issue in a private GitHub repo named by `FEEDBACK_GITHUB_REPO` (planned: `lius24/ai-tutor-feedback`). | A plain link to GitHub Issues would shut out students without a GitHub account. The app repo is public, so reports filed there would be public too. |
| D2 | Only signed-in users who aren't guests can send feedback. A Firebase anonymous session ("Guest") counts as signed out. | The rate limit needs a stable identity, and reports need someone to follow up with. |
| D3 | There are two entry points: a "Feedback" item in the sidebar, and a "Report a problem" button in the textbook panel header. | The sidebar item covers general feedback. The panel button catches a wrong page at the moment the student sees it. |
| D4 | A report has four types (bug, content, suggestion, other), a required description of at most 2000 characters, and an optional "you can contact me" box, off by default. | That is enough to triage. The default respects students who only want to report a problem. |
| D5 | Each user can send at most 5 accepted reports per rolling hour. | This stops floods and never gets in a real user's way. |
| D6 | If GitHub fails, the report is stored in the MongoDB collection `feedback`, and the student is still told it was received. The request fails only when both fail. | A GitHub outage or an expired token never loses a report. |
| D7 | Issue titles, labels and field names are in English, for example `[Content] …` and `type:content`. | The UI is localized; the team's issue tracker is not. |
| D8 | The reporter's email appears only when the student ticked the contact box. Otherwise the issue shows a short pseudonymous code. | The box is consent to be contacted. The code still links repeat reports from one person. |
| D9 | No new dependencies: the backend uses `urllib`, the frontend uses `fetch`. | |

## 3. What the student sees

### 3.1 Entry points

**Sidebar**

- `frontend/src/components/Sidebar.tsx` gets a "Feedback" item as the first child of `.sb-footer`. It sits directly above the account block, or above the "Sign in" button when signed out.
- Like the account block, it renders only once auth has finished loading (`!loading`), so a click can't happen before the app knows whether the student is signed in.
- The item is a `<button type="button" className="sb-link sb-feedback">` with the usual `sb-link-ic` icon and `sb-link-label` label, so the collapsed sidebar shows only its icon, like every other item.
- `title` and `aria-label` are both set to the label.
- The icon is a speech bubble added to the sidebar's `I` icon set, drawn the same way as the existing icons, with the path `M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z`.
- Clicking it opens the dialog with no type preselected.

**Textbook panel**

- `frontend/src/LearningModel.tsx` gets a "Report a problem" button as the first child of `.left-panel-topic-bar-actions`. The order becomes Report a problem, Note, Hide.
- The button reuses the Hide button's classes (`left-panel-hide-btn left-panel-hide-btn--in-bar`) and adds `left-panel-report-btn`.
- Its `title` is "Report a problem with this page".
- That bar is rendered only while a section is open. The bare hide row shown when no section is open gets no report button.
- Clicking it opens the dialog with "Wrong page or content" preselected.

### 3.2 Signed-out visitors and guests

- When `user` is null or `user.isAnonymous` is true, both entry points call `setShowSignIn(true)`, and the dialog does not open.
- Both entry points stay visible to these visitors.
- After signing in, the student clicks the entry point again. The dialog does not reopen by itself.
- The server enforces the same rule (§4.2).

### 3.3 The dialog

`FeedbackModal` follows `SignInModal`'s visual language: the same overlay, card, corner radius and type styles. From top to bottom:

1. The title "Send feedback", and a × button.
2. **Type:** four radio buttons in a fieldset whose legend is "What kind of feedback?". From the sidebar, nothing is preselected. From the textbook panel, "Wrong page or content" is preselected.
3. **Description:** a textarea with `maxLength={2000}` and a placeholder. Under it, a live "n / 2000" counter.
4. **Contact:** an unchecked checkbox labelled "You can contact me at {email}", showing the account's email.
5. One muted line saying what is attached (`feedback.attached` in §3.5).
6. **Cancel** and **Send**. Send stays disabled until a type is chosen and the description contains a character that isn't whitespace.

**States**

| State | What the student sees |
|---|---|
| Editing | The form above. |
| Sending | Send shows a spinner and "Sending…". The inputs, Cancel, × and Esc are disabled, so the student can't close the dialog and miss the result. The server answers within about 15 s (§4.4, §4.5). The client gives up after 30 s and treats that as `unavailable`. |
| Sent | The form is replaced by "Thanks, we got it." and a Close button. The dialog closes itself after 2.5 s. |
| Error | An alert appears above the buttons with the message from §5.4. The form becomes editable again, with everything the student typed, and Send retries. |

**Closing**

- ×, Cancel and Esc close the dialog, except while it is sending.
- A click on the backdrop does nothing, so a stray click can't throw away a long description. (`SignInModal` does close on a backdrop click, but it has no typed text worth protecting.)
- Every open starts with an empty form, apart from the preset type.

**When the sign-in has expired (`auth` result)**

- The dialog stays open and keeps the draft.
- It shows "You need to sign in again to send this." with a **Sign in** button that calls `setShowSignIn(true)`.
- The dialog's overlay uses a z-index one below `.signin-overlay`'s, so the sign-in modal appears on top.
- While the sign-in modal is open (`showSignIn` is true), the dialog ignores Esc.
- After the student signs in, Send works again: it fetches a fresh token each time (§5.3).

**Accessibility**

- The dialog has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at the title.
- On open, focus moves to the first radio button, or to the textarea when a type is preset.
- On close, focus returns to the element that opened the dialog.
- The error alert has `role="alert"`, and the sent message has `role="status"`.

**Narrow screens (640 px wide or less):** the card spans the full viewport width, and Cancel and Send stack, each full width.

### 3.4 What is attached

| Field | Source | Present when |
|---|---|---|
| `book_id` | The book Learning Mode registered (§5.2); otherwise `readSelectedTextbookId()`. | Always |
| `section` | The open section's title, `dataMatchedTopic.name`, which includes its number, e.g. "2.4 System Response to External Input: The Zero-State Response". | In Learning Mode with a section open |
| `page` | The printed page on screen: `dataMatchedTopic.startBook + sectionPageIndex`. `LearningModel.tsx` already maps book pages to page indexes this way. | In Learning Mode while a section's pages are shown |
| `locale` | The current UI locale, from `LocaleContext`. | Always |
| `route` | `window.location.pathname`, without the query string or hash. | Always |
| browser | The request's `User-Agent` header, read by the server. | Always |

Never attached: chat messages, notes, uploaded files, query strings.

### 3.5 Copy

These keys are new in `frontend/src/i18n/messages.ts`. `ZH` and `ES` are typed `Record<MessageKey, string>`, so `tsc -b` fails if any translation is missing. Use these values verbatim.

| Key | en | zh | es |
|---|---|---|---|
| `feedback.sidebarItem` | Feedback | 反馈 | Comentarios |
| `feedback.reportProblem` | Report a problem | 报告问题 | Reportar un problema |
| `feedback.reportProblemTitle` | Report a problem with this page | 报告这一页的问题 | Reportar un problema con esta página |
| `feedback.title` | Send feedback | 反馈意见 | Enviar comentarios |
| `feedback.close` | Close | 关闭 | Cerrar |
| `feedback.typeLegend` | What kind of feedback? | 反馈类型 | ¿Qué tipo de comentario es? |
| `feedback.type.bug` | Something is broken | 程序出错 | Algo no funciona |
| `feedback.type.content` | Wrong page or content | 页码或内容有误 | Página o contenido incorrecto |
| `feedback.type.suggestion` | Suggestion | 建议 | Sugerencia |
| `feedback.type.other` | Other | 其他 | Otro |
| `feedback.descriptionLabel` | Description | 描述 | Descripción |
| `feedback.descriptionPlaceholder` | What happened, and what did you expect? | 发生了什么？你原本期望看到什么？ | ¿Qué pasó y qué esperabas? |
| `feedback.charCount` | {count} / {max} | {count} / {max} | {count} / {max} |
| `feedback.contact` | You can contact me at {email} | 可以通过 {email} 联系我 | Pueden contactarme en {email} |
| `feedback.attached` | We'll include where you are in the app (course, section, page), your language and your browser. Never your chats. | 会附上你在应用中的位置（课程、章节、页码）、界面语言和浏览器信息，不包含聊天内容。 | Incluiremos dónde estás en la app (curso, sección, página), tu idioma y tu navegador. Nunca tus chats. |
| `feedback.cancel` | Cancel | 取消 | Cancelar |
| `feedback.send` | Send | 提交 | Enviar |
| `feedback.sending` | Sending… | 提交中… | Enviando… |
| `feedback.sent` | Thanks, we got it. | 谢谢，我们已收到。 | Gracias, lo recibimos. |
| `feedback.errorAuth` | You need to sign in again to send this. | 需要重新登录后才能提交。 | Tienes que volver a iniciar sesión para enviarlo. |
| `feedback.signIn` | Sign in | 登录 | Iniciar sesión |
| `feedback.errorRateLimited` | You're sending feedback too often. Try again in about {minutes} min. | 提交太频繁，请约 {minutes} 分钟后再试。 | Estás enviando comentarios con demasiada frecuencia. Vuelve a intentarlo en unos {minutes} min. |
| `feedback.errorInvalid` | Please check the form and try again. | 请检查填写的内容后重试。 | Revisa el formulario y vuelve a intentarlo. |
| `feedback.errorUnavailable` | Couldn't send right now. Please try again in a moment. | 暂时无法提交，请稍后再试。 | No se pudo enviar en este momento. Vuelve a intentarlo en un rato. |

## 4. Backend

### 4.1 Endpoint

`POST /api/feedback` goes in `backend/api_routes.py`.

- It is a plain `def`, not `async def`. FastAPI runs plain handlers in its thread pool, so the blocking GitHub and MongoDB calls never stall the event loop that every `async def` route shares.
- It reads the request header `Authorization: Bearer <Firebase ID token>`.
- Its body is validated by Pydantic v2 models in the new `backend/feedback.py`:

```python
FeedbackType = Literal["bug", "content", "suggestion", "other"]

class FeedbackContext(BaseModel):
    book_id: Optional[str] = None   # cut to 64 characters
    section: Optional[str] = None   # cut to 200 characters
    page: Optional[int] = None      # dropped unless 1..10000
    locale: Optional[str] = None    # cut to 10 characters
    route: Optional[str] = None     # cut to 200 characters

class FeedbackRequest(BaseModel):
    type: FeedbackType
    description: str                # cleaned and stripped; 1..2000 characters
    contact_ok: bool = False
    context: FeedbackContext = Field(default_factory=FeedbackContext)
```

**Description**

- Control characters (Unicode category `Cc`) other than `\n` and `\t` are removed, then surrounding whitespace is stripped.
- An empty result, or one longer than 2000 characters, is a 422.
- Python counts code points, while the browser's `maxLength` counts UTF-16 code units. So the client's limit is never looser than the server's.

**Context**

- Context is best-effort metadata, so it never causes a 422.
- A `mode="before"` validator removes control characters from each string and cuts it to its limit. It drops any field whose value has the wrong type, and drops `page` unless it is an integer from 1 to 10000. Dropping a field means setting it to None.
- `context` itself must be an object, or left out.

**Unknown fields** are ignored, which is Pydantic's default.

**Responses**

| Status | Body | When |
|---|---|---|
| 200 | `{"ok": true}` | The report was delivered to GitHub or stored in the MongoDB fallback. By design, the student can't tell which. |
| 401 | `{"detail": "Not authenticated"}` | The ID token is missing or invalid. |
| 403 | `{"detail": "Guests can't send feedback"}` | The token belongs to an anonymous session (an `anon:` identity). |
| 422 | FastAPI's validation error | `type` is not one of the four, or the description is empty or too long. |
| 429 | `{"detail": "Too many feedback submissions", "retry_after_seconds": N}`, plus the header `Retry-After: N` | The user is over the rate limit. The number is also in the body because a cross-origin page can't read `Retry-After` unless CORS exposes that header, and `main.py`'s CORS setup doesn't. |
| 503 | `{"detail": "Feedback is temporarily unavailable"}` | GitHub and MongoDB both failed. |

FastAPI validates the body before the handler runs, so a malformed body gets a 422 even without a token. That is harmless.

### 4.2 Order of handling

1. `identity = verify_token(authorization)`. If it is None, return 401.
2. If `identity.startswith("anon:")`, return 403.
3. `wait = _feedback_limiter.reserve(identity)`. If it isn't None, return 429.
4. Build the issue (title, body, labels) from the request, the identity and the `User-Agent` header (§4.4).
5. Send the issue to GitHub. On success, return 200.
6. On `FeedbackDeliveryError`, store the report in MongoDB (§4.5). On success, return 200.
7. Otherwise, return 503.

Any path from step 4 on that doesn't end in a 200, including an unexpected exception, first calls `_feedback_limiter.release(identity)`. Failures never use up the student's quota.

### 4.3 Rate limit

```python
class FeedbackRateLimiter:
    def __init__(self, limit: int = 5, window_seconds: int = 3600,
                 clock: Callable[[], float] = time.monotonic) -> None: ...

    def reserve(self, identity: str) -> Optional[int]:
        """Record a submission and return None; or, if the limit is reached,
        record nothing and return the seconds to wait (at least 1)."""

    def release(self, identity: str) -> None:
        """Forget identity's most recent reservation, because its delivery failed."""
```

- The limiter keeps a deque of timestamps for each identity. Every call drops timestamps older than the window, and deletes an identity whose deque becomes empty.
- A `threading.Lock` guards all of its state, because plain handlers run concurrently in the thread pool.
- The wait is `ceil(oldest + window - now)`, and never less than 1.
- There is one module-level instance, `api_routes._feedback_limiter`, which tests replace.

**Limits:** the state lives in memory.
- It resets on every restart, which includes every Render deploy.
- If the backend ever runs several processes, each one counts separately.

That is accepted, because this guards against floods; it is not a quota.

### 4.4 The GitHub issue

**Configuration**

- Delivery is on when `FEEDBACK_GITHUB_TOKEN` and `FEEDBACK_GITHUB_REPO` are both set, and the repo matches `^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$`.
- Both are read with `os.getenv` at call time.

**Request.** Sent with the standard library's `urllib.request`, with a 10 s timeout:

```
POST https://api.github.com/repos/{FEEDBACK_GITHUB_REPO}/issues
Authorization: Bearer {FEEDBACK_GITHUB_TOKEN}
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
User-Agent: ai-tutor-feedback
Content-Type: application/json

{"title": "...", "body": "...", "labels": ["type:content", "book:lathi"]}
```

**Outcomes**

- **HTTP 201:** success. Log the issue `number` from the response.
- **HTTP 422:** GitHub rejected part of the issue, usually a label. Send it once more without `labels`, so a label problem never pushes reports into the fallback.
- **Anything else** raises `FeedbackDeliveryError`. "Anything else" means another status, a timeout, `URLError`, `OSError`, `http.client.HTTPException`, or a response that can't be parsed. The error's message is short and never includes the token or a response body:
  - `"HTTP <code>"` for an HTTP error status;
  - the exception's class name otherwise, such as `"TimeoutError"` or `"URLError"`;
  - `"not configured"` when the environment variables are missing. This one is raised before any request is made.

**Title.** The format is `[<Tag>] <summary>`.

- `<Tag>` is `Bug`, `Content`, `Suggestion` or `Other`.
- `<summary>` is the description with every run of whitespace collapsed to one space, cut to 60 characters. `…` is appended only when something was cut.

**Labels**

- `type:<type>` is always added.
- `book:<book_id>` is added too when `bb.is_builtin(book_id)` is true.
- Uploaded books (`user_…`) get no book label. Their id still appears in the table.

**Body**

```markdown
**Type:** Wrong page or content
**Reporter:** student@example.com

### Description

(the description)

### Context

| Field | Value |
|---|---|
| Course | Linear Systems and Signals (Lathi) (`lathi`) |
| Section | 2.4 System Response to External Input: The Zero-State Response |
| Page | 170 |
| Language | zh |
| Route | /learning |
| Browser | Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) … |
| Submitted | 2026-10-01 14:03 UTC |

<sub>Sent from the AI Tutor feedback form.</sub>
```

- **Type line:** uses the English names "Something is broken", "Wrong page or content", "Suggestion" and "Other".
- **Reporter line:**
  - When `contact_ok` is true, it shows the identity.
  - Otherwise it shows `anonymous #<code>`, where `<code>` is the first 8 hex digits of `sha256("ai-tutor-feedback:" + identity)`.
  - The code shows the team that several reports came from one person, without showing who. It is pseudonymous, not anonymous: anyone who knows an email can compute it. That is acceptable in a private repo the team controls.
- **Course row:** for a builtin book, `bb.load_meta(book_id)["display_name"]` followed by the id in backticks. For any other book, just the id.
- **Rows** with no value are left out.
- **Submitted:** the server's time in UTC, formatted `%Y-%m-%d %H:%M UTC`.
- **Table cells:** `|` becomes `\|`, and newlines become spaces.
- **User-supplied strings:** every one goes through `neutralize_mentions`. That covers the title, description, section, route, book id and browser. The function inserts U+200B after any `@` that starts a word:
  `re.sub(r"(?<![A-Za-z0-9_])@(?=[A-Za-z0-9])", "@​", text)`
  - An `@name` typed in a report therefore notifies nobody.
  - Email addresses stay intact, because their `@` follows a letter.
- **User-Agent:** cut to 300 characters.

### 4.5 Fallback store

`backend/database.py` gets a `feedback()` accessor. It returns the `feedback` collection, or None, following the same pattern as `grades()`.

When delivery raises `FeedbackDeliveryError`, the route inserts this document:

```python
{
    "created_at": datetime.now(timezone.utc),
    "type": "content",
    "title": "[Content] …",
    "body": "<the issue body from §4.4>",
    "labels": ["type:content", "book:lathi"],
    "reporter_ref": "a1b2c3d4",
    "contact_email": "student@example.com",   # None unless contact_ok
    "context": {"book_id": "lathi", "section": "2.4 …", "page": 170, "locale": "zh", "route": "/learning"},
    "user_agent": "Mozilla/5.0 …",
    "status": "pending",
    "github_error": "HTTP 502",
}
```

- The title, body and labels are stored ready-made. A pending record can be pasted into GitHub as-is, or replayed by a script if that is ever needed.
- The email is stored only when `contact_ok` is true, the same rule as for the issue.
- The insert runs inside `with pymongo.timeout(5):`, so a hung database can't hold the request. `pymongo.timeout` needs pymongo 4.2 or later, and `requirements.txt` pins `pymongo>=4.6.0`.
- The fallback fails, and the request returns 503, when `feedback()` returns None (because `MONGODB_URI` isn't set) or when the insert raises.

The worst case is therefore about 15 s: 10 s for GitHub plus 5 s for MongoDB.

### 4.6 Configuration and logging

**Environment.** Both variables are set on Render only. Neither ever appears in the frontend, the repo or a log.

- `FEEDBACK_GITHUB_TOKEN`: a fine-grained personal access token. Under repository access, choose "Only select repositories" and pick the feedback repo. Grant the permission Issues: Read and write.
- `FEEDBACK_GITHUB_REPO`: the repo, in the form `owner/name`.

**At startup.** `startup()` in `main.py` calls `feedback.log_config_status()`, which prints one of these lines:

- `[Feedback] GitHub delivery enabled (lius24/ai-tutor-feedback)`
- `[Feedback] GitHub delivery disabled: FEEDBACK_GITHUB_TOKEN or FEEDBACK_GITHUB_REPO not set; feedback is stored in MongoDB only`

**For each report.** One line is logged. It never includes the description or the email:

- `[Feedback] issue #12 created (type=content, book=lathi)`
- `[Feedback] GitHub failed (HTTP 502); stored in MongoDB as pending`
- `[Feedback] GitHub failed (TimeoutError) and MongoDB failed (ServerSelectionTimeoutError); returned 503`

## 5. Frontend

### 5.1 Files

| File | Change |
|---|---|
| `frontend/src/feedback/FeedbackContext.tsx` | **New.** The provider and `useFeedback()` (§5.2). |
| `frontend/src/feedback/FeedbackModal.tsx` and `FeedbackModal.css` | **New.** The dialog (§3.3). |
| `frontend/src/feedback/feedbackApi.ts` | **New.** `submitFeedback()` (§5.4). |
| `frontend/src/context/AuthContext.tsx` | Add `getFreshToken()` (§5.3). |
| `frontend/src/main.tsx` | Wrap `<App />` in `<FeedbackProvider>`, inside the existing providers, so it can read auth and locale. |
| `frontend/src/App.tsx` | Mount `<FeedbackModal />` next to `<SignInModal />`. |
| `frontend/src/components/Sidebar.tsx` | Add the Feedback item and its icon (§3.1). |
| `frontend/src/LearningModel.tsx` | Add the Report a problem button and register the page context (§5.5). |
| `frontend/src/i18n/messages.ts` | Add the strings in §3.5. |

### 5.2 FeedbackContext

```ts
export type FeedbackType = "bug" | "content" | "suggestion" | "other";

/** What Learning Mode knows about the screen. */
export interface FeedbackPageContext {
  bookId?: string;
  section?: string;
  page?: number;
}

/** The `context` object sent to POST /api/feedback. */
export interface FeedbackRequestContext {
  book_id?: string;
  section?: string;
  page?: number;
  locale?: string;
  route?: string;
}

interface FeedbackContextValue {
  /** Opens the dialog, or the sign-in modal for signed-out users and guests (§3.2). */
  openFeedback: (opts?: { type?: FeedbackType }) => void;
  closeFeedback: () => void;
  /** Learning Mode calls this when the book, section or page changes, and with null on unmount. */
  registerPageContext: (ctx: FeedbackPageContext | null) => void;
  /** Read by FeedbackModal. */
  isOpen: boolean;
  presetType: FeedbackType | null;
  snapshot: FeedbackRequestContext;
}
```

- The registered page context lives in a ref, not in state, so turning pages doesn't re-render the sidebar.
- `openFeedback` takes the snapshot once, when the dialog opens. It records:
  - `book_id`: the registered book, or else `readSelectedTextbookId()`;
  - `section` and `page`;
  - `locale`;
  - `route`.
- The snapshot doesn't change while the dialog is open.
- `openFeedback` also remembers `document.activeElement` at that moment, so focus can return there on close.

### 5.3 A fresh ID token

**Background.** Firebase ID tokens last an hour. `AuthContext` used to fetch the token once, at sign-in, so a tab left open longer sent stale tokens and got 401s on every signed-in request. The fix on branch `fix/auth-token-refresh` (commit `ffe024a`) merges before this feature. It asks Firebase for the token every 4 minutes, when the tab becomes visible again, and when the browser comes back online, so `token` stays valid in the background.

**Just in time for a send.** A send can still land in the moment between a laptop waking up and the background refresh running. So the dialog asks for a token right before each send, through a new context function:

```ts
getFreshToken: () => Promise<string | null>;

const getFreshToken = useCallback(async () => {
  const current = auth?.currentUser;
  return current ? current.getIdToken() : null; // cached, or refreshed when close to expiry
}, []);
```

- The dialog calls `getFreshToken()` just before every send.
- If `getIdToken()` throws (for example, offline), the result is `unavailable`. If `getFreshToken()` returns null, the result is `auth`.

### 5.4 Submitting and errors

```ts
export type SubmitResult =
  | { ok: true }
  | { ok: false; kind: "auth" }                                   // 401, 403, or no token
  | { ok: false; kind: "rateLimited"; retryAfterMinutes: number }  // 429
  | { ok: false; kind: "invalid" }                                // 422
  | { ok: false; kind: "unavailable" };                           // any other status, a network error, or the 30 s timeout

export async function submitFeedback(
  token: string,
  payload: { type: FeedbackType; description: string; contact_ok: boolean; context: FeedbackRequestContext },
  signal?: AbortSignal,
): Promise<SubmitResult>;
```

- **Request:** `POST apiUrl("/api/feedback")`, with the headers `Authorization: Bearer <token>` and `Content-Type: application/json`, and the payload as the body.
- **Rate limit:** `retryAfterMinutes = max(1, ceil(retry_after_seconds / 60))`, read from the response body. When the body has no usable number, use 60.

**What the dialog does with each result**

| Result | Dialog |
|---|---|
| `ok` | Sent state. |
| `auth` | Stays open, shows `feedback.errorAuth` and the Sign in button (§3.3). |
| `rateLimited` | Shows `feedback.errorRateLimited` with the minutes. |
| `invalid` | Shows `feedback.errorInvalid`. |
| `unavailable` | Shows `feedback.errorUnavailable`. |

### 5.5 Learning Mode wiring

```ts
const { openFeedback, registerPageContext } = useFeedback();

useEffect(() => {
  registerPageContext({
    bookId: textbookId,
    section: dataMatchedTopic?.name,
    page:
      dataMatchedTopic && referenceSectionPages?.length
        ? dataMatchedTopic.startBook + sectionPageIndex
        : undefined,
  });
}, [registerPageContext, textbookId, dataMatchedTopic, referenceSectionPages, sectionPageIndex]);

useEffect(() => () => registerPageContext(null), [registerPageContext]);
```

The Report a problem button calls `openFeedback({ type: "content" })`.

## 6. Testing

### 6.1 Backend

These tests run under pytest with no network, no keys and no MongoDB. Use `backend/.venv` and pass `--ignore=test_output.txt`.

**`backend/test_feedback.py`** tests `feedback.py` directly.

*Title*

- Each type maps to its tag.
- Runs of whitespace are collapsed.
- A 60-character summary is kept whole, with no `…`. A 61-character one is cut to 60 plus `…`.

*Mentions*

- `@alice` and `@org/team` get U+200B.
- `a@b.com` is unchanged.

*Body*

- Rows appear when they have a value and are left out otherwise.
- `|` and newlines are escaped in table cells.
- The email appears only with `contact_ok`. Otherwise the pseudonymous code appears, and it is the same for the same identity.
- The User-Agent is cut to 300 characters.

*Labels*

- `type:*` is always present.
- `book:lathi` and `book:focs` are added for builtin books.
- `user_abc` gets no book label.

*Validation*

- Context: over-long strings are cut, and a bad or out-of-range `page` is dropped. Neither is ever an error.
- Description: control characters are removed. A whitespace-only description is rejected. 2000 CJK characters are accepted. 2001 characters are rejected.
- An unknown `type` is rejected.

*Limiter, with a fake clock*

- Five reservations pass. The sixth returns a wait of at least 1 and records nothing.
- Reservations pass again once the window has moved on.
- Identities count separately.
- `release` frees a slot.

*GitHub client, with `urllib.request.urlopen` replaced by a fake*

- The URL, the method, every header (including the Bearer token) and the JSON body are correct.
- A 201 returns the issue number.
- A 422 leads to a second request without `labels`.
- A 500, a timeout and a `URLError` each raise `FeedbackDeliveryError`, and the error's message never contains the token.
- Missing configuration raises `FeedbackDeliveryError("not configured")` without calling `urlopen`.

**`backend/test_feedback_api.py`** exercises the route through `TestClient`.

Setup:

- a minimal app with only `api_routes.router`, as `test_api_grades.py` does;
- `api_routes.verify_token` monkeypatched;
- the GitHub sender and `database.feedback` replaced by fakes;
- a fresh limiter with a fake clock.

Cases:

- No token gives a 401. An `anon:` identity gives a 403. A bad body gives a 422.
- A successful send gives a 200. The fake sender received the right title, labels and body, and the request's `User-Agent` appears in the body.
- When GitHub fails, the report is stored in the fake collection with `status: "pending"` and the error, and the response is a 200.
- When GitHub isn't configured, the report is stored and the response is a 200.
- When GitHub fails and MongoDB is missing (None) or raises, the response is a 503 and the slot is released: five more reports still go through.
- The sixth report within an hour gives a 429, with the `Retry-After` header and `retry_after_seconds` in the body.
- The token never appears in captured output or in the stored record.

### 6.2 Frontend

These tests use vitest and Testing Library, which are already in `devDependencies`.

**`feedback/feedbackApi.test.ts`**, with `fetch` mocked:

- 200 gives `ok`.
- 401 and 403 give `auth`.
- 422 gives `invalid`.
- 429 with `retry_after_seconds: 61` gives 2 minutes. A 429 without it gives 60.
- 500 and a rejected fetch give `unavailable`.
- The request is a POST, with the Bearer header and the JSON body.

**`feedback/FeedbackContext.test.tsx`**

- Signed out, or signed in as a guest: `setShowSignIn(true)` is called, and the dialog stays closed.
- Signed in: the dialog opens with the preset type, and the snapshot includes the registered page context.
- Registering null clears the section and page.
- `book_id` falls back to `readSelectedTextbookId()`.

**`feedback/FeedbackModal.test.tsx`**, with `submitFeedback` and `getFreshToken` mocked:

- Send is disabled until a type is chosen and the description isn't blank.
- The counter updates as the student types.
- The contact checkbox shows the account's email.
- While sending, the inputs, Esc and × are disabled.
- On success, the sent message shows, and then the dialog closes itself (fake timers).
- Each error kind shows its own message and keeps the typed text.
- `auth` keeps the dialog open with its draft, and the Sign in button calls `setShowSignIn(true)`.
- Esc is ignored while the sign-in modal is open.
- A click on the backdrop doesn't close the dialog.
- Focus moves into the dialog on open, and returns to the opener on close.

**Existing checks stay green:** `tsc -b`, `vitest run` and `npm run build`.

### 6.3 Browser checks before the PR

**What can't be checked locally.** A local backend has no Firebase credentials, because worktrees never get a `backend/.env`. Every request gets a 401, so the dialog's full flow can't run locally.

**Signed-out checks, on the local stack:**

- Both entry points open the sign-in modal.
- The Feedback item shows in both the expanded and the collapsed sidebar.
- The onboarding tour still highlights the right elements.

**The dialog's look.** Apply a throwaway patch that skips the sign-in gate, and never commit it. With it:

- take screenshots of the dialog at 1440×900 and at 400×800, in its editing, sending and error states;
- then discard the patch.

### 6.4 After deploy

1. The Render log shows `[Feedback] GitHub delivery enabled (lius24/ai-tutor-feedback)`.
2. The user, signed in on the production site, sends one report from the textbook panel on Signals §2.4, with the contact box unticked. Check the issue:
   - it appears in the feedback repo;
   - it has the labels `type:content` and `book:lathi`;
   - the page is in its table;
   - it shows no email.

   Then close it.
3. As a guest, both entry points open the sign-in modal.

## 7. Rollout

1. **The user, once:**
   - creates the private repo;
   - creates the token described in §4.6;
   - adds both environment variables on Render. Saving them redeploys the current code, which is harmless.
2. **Labels.** After the user confirms, six labels are created with `gh label create`: `type:bug`, `type:content`, `type:suggestion`, `type:other`, `book:focs` and `book:lathi`.
   - If `gh` can't reach the repo, the user creates them in the web UI.
   - A missing label never loses a report, thanks to the 422 retry (§4.4).
3. **The PR:**
   - The user merges it from the alt account, and Vercel deploys the frontend.
   - Deploy Render manually right away. Until Render is live, sending shows `feedback.errorUnavailable`.
4. Run the checks in §6.4.

## 8. Out of scope

- Screenshots or other attachments.
- Replying to students in the app, or showing them the status of their reports.
- An admin page. Triage happens in GitHub.
- Replaying `pending` fallback records automatically. If any ever appear, add a script.
- Feedback from guests or signed-out visitors.
- A rate limit that survives restarts or spans processes.
- Restyling to match the parked redesign mockups. If the team adopts one, these entry points are restyled with the rest of the app.

## 9. Risks and known limits

**Token expiry.** A fine-grained token expires. After that, every report lands in the MongoDB fallback with `github_error: "HTTP 401"`, while students still see "received". To catch it:

- choose the longest expiry the account allows, and put the date in the team calendar;
- search the Render logs for `[Feedback] GitHub failed` from time to time.

**The rate limit lives in memory.** See §4.3.

**The reporter code is pseudonymous, not anonymous.** See §4.4.

**Context comes from the client.** A modified client can claim any section or page. Context is used for triage only and trusted for nothing else.
