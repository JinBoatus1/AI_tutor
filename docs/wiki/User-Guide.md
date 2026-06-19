# User Guide

> **Maintainers:** Treat this as the only end-user page in the repo. Edit `docs/wiki/User-Guide.md` on `main`, then copy the full content into the GitHub Wiki **User Guide** page (or the Wiki **Home**).

---

## What is AI Tutor?

AI Tutor is a web app for **college-level math** study. It connects a **chat tutor** to a **textbook outline** (built-in **FOCS / FCOS** or a **PDF** you upload after sign-in), shows **book page images** next to the chat, and includes an **Auto Grader** that scores a **question file** plus your **answer file** (PDF or images).

You do **not** need an account for **Learning Mode** or **Auto Grader**. Signing in unlocks **saved chat** (when the deployment supports it), **synced learning progress**, and **My profile** (custom textbooks, appearance, account).

---

## How to open the app

1. Open the URL your team publishes, **or**
2. **Run locally:** clone the repo, start the backend (`uvicorn`) and frontend (`npm run dev`) as in the root **README**.

Use a **modern browser** (Chrome, Firefox, Safari, Edge). If you see **mixed content** or API errors, the deployment may be wrong (HTTPS, `VITE_API_URL`)—contact whoever hosts the app.

---

## Top navigation

| Link | Who can use it | What it does |
|------|----------------|--------------|
| **Home** | Everyone | Landing; entry points to **Learning Mode** and **Sign in**. |
| **Learning Mode** | Everyone | Main tutor: **outline** + **book** + **chat** (three columns). |
| **Auto Grader** | Everyone | Upload **question** and **answer** files for automatic scoring. |
| **My profile** | **Signed in only** (if not signed in, opens sign-in) | Textbooks, appearance, account. |

When signed in, the bar shows your **avatar / name** and **Sign out**.

---

## Sign in and your account (optional)

**Why sign in**

- Chat history can persist (needs backend + database on the host).
- Learning progress (dots in the outline) can **sync** to your account.
- **My profile:** upload a **PDF textbook**, set **colors** (page + chat), manage books.

**How:** Use **Sign in** (Home, banner, or when opening **My profile**), usually with **Google** (Firebase). After sign-in you see **avatar** and **Sign out**.

**Without an account** you can still use Learning Mode and Auto Grader; progress may stay **on this device only**.  

**For hosting / Firebase / backend** configuration, see **`docs/firebase.md`** and the root **README** in the repository.

---

## Learning Mode

This is the main study screen: **left** = outline (learning progress), **center** = book pages, **right** = chat.

### First time

1. Read the short **welcome** in the chat (how to use the tree and ask questions).
2. On your **first visit** to Learning Mode, a **product tour** may dim the screen and point out the outline, history, **Start a new session**, **Note**, and chat. Use **Next** / **Skip tour**, or replay it anytime from **My profile** → **Product tour** → **Restart tour** (signed in).
3. If you are **signed in**, you may see **past chat sessions** under **History** in the left sidebar.

### Worked example: induction (Problem 5.1)

This walkthrough shows how the **left outline**, **center book + Note + Problems**, and **right chat** work together on a real FOCS topic.

#### 1. Open the chapter’s **Problems** section (left)

In **Learning progress**, expand **Chapter 5 — Induction**, then click the section named **`5.3 Problems`** (page range in parentheses, e.g. `(pp. …)`).

> **Important:** You must click a row whose title ends with **`Problems`** (e.g. `5.3 Problems`, `1.6 Problems`). That is the chapter **problem set**, not a single exercise like “Problem 5.1” in the book text. Other titles such as “Problem Solving with Graphs” are **not** problem sets and will not open practice.

After you click **`5.3 Problems`**:

- The **center** top area opens **Chapter 5 practice** (warm-up, quizzes, proof drills tied to the chapter).
- The **bottom** of the center still shows **book page images** for the loaded section.
- You can drag the **horizontal divider** between practice and pages to resize.

#### 2. Read the section and open **Note** (center)

For definitions and curated help (objectives, key vocabulary, formulas):

1. In the **left** tree, click a **lesson section** such as **`5.1 Ordinary Induction`** (not the Problems row).
2. Wait for **book pages** to load in the **center**.
3. Click **`Note`** in the bar above the pages (top-right of the textbook panel).

The **Note** panel lists what to learn, important terms, and formulas for that section. You can **See in textbook ↗** to jump to a book example, or **Ask AI to follow up** from a term. Click **`Note`** again or **Collapse** to hide it.

If you opened **`5.3 Problems`** first, you can still switch to **`5.1 Ordinary Induction`** in the tree for the reading + **Note**, while keeping practice available when you return to **`5.3 Problems`**.

#### 3. Try the sample questions (right chat)

Above the chat input, **Try an example** offers two starters (book content stays in **English**):

| # | Example | What happens when you click |
|---|---------|------------------------------|
| 1 | **What is induction?** | The text is **copied into the input box** (not sent). Press **Enter** or **Send** when ready. |
| 2 | **Problem 5.1:** Is 2^p − 1 prime for p = 2, 3, 5, 7? … | Same: fills the input with the full Problem 5.1 wording from the book; you send it yourself. |

The AI reply may **match** the topic and show related pages in the **center** (e.g. **5.1 Ordinary Induction** with **Note** available). For the best alignment, click the relevant **section** or **`5.3 Problems`** in the **left** tree **before** or **after** you ask.

#### 4. Start fresh

Use **Start a new session** at the top of the chat when you change chapters or want a clean thread.

### Left: Learning progress (outline)

- **Tree** of chapters and sections. **Parentheses** = **printed book page numbers** (match the physical book), e.g. `(pp. 7–14)`.
- **Teal dot** = marked **learned**; **hollow** circle = **not learned** yet. Click the dot to toggle (some parent rows update children per app rules).
- Click **section title text** (with page numbers) to **load** those book pages in the **center**.
- Rows titled **`X.Y Problems`** (e.g. **`5.3 Problems`**) open the chapter **practice / problem-set** view in the **center**—see the **Worked example: induction** above.
- **Expand all** / **Collapse all**; drag the **divider**; **collapse** the whole left strip for more room, **reveal** to show it again.
- The header shows which **book** (e.g. **FCOS**). Guests default to the built-in book; **signed-in** users select PDFs in **My profile**.

### Center: Textbook (page preview)

- The line **Pages A–B** is **printed book** range, aligned with the **left** tree.
- **`Note`** (when shown) opens a **curated study note** for the current section—objectives, vocabulary, formulas, and links into the book. See the induction example above.
- When a **`Problems`** section is selected, the **top** of the center may show **interactive practice**; **book pages** stay in the **bottom** pane (resize with the divider).
- **Prev** / **Next** and **“Page 1 of N”** refer to **images in this load**: **1 of N** = **image** index, **not** a printed page number. Do **not** mix that up with the header **“Pages 145–160”**.
- Wait for images after you pick a section or after a topic is **matched**. You can open images in a lightbox when the UI offers it. **Hide** closes the center; use **Show textbook sidebar** in the chat if the book panel is hidden but there is still content for this session.

### Right: Chat

- Type a question, **Enter** or **Send**.
- **Try an example** (above the input, before your first message): click a sample question to **copy it into the input**; edit if you like, then send.
- **Attach:** file button for **image / PDF**; **monitor** icon for **screen capture** (the browser may ask for a target).
- **Paste** images (Ctrl+V / Cmd+V) when supported.
- **Start a new session** clears the current thread (e.g. when changing chapters or problem sets).
- **Tips:** name **section numbers** (`3.2`, `Chapter 11`, …) or **click the section** (or **`X.Y Problems`**) in the tree first, then ask about what you see in the **center**.

### Optional: full-page learning progress

Add **`/learning-bar`** to your app URL (e.g. `https://yoursite.example/learning-bar`). Same **outline and progress** as the **left** column, but **without** the three-column Learning Mode layout—use if you only want a large tree. **Main** reading + chat stays in **Learning Mode**. The **current textbook** is the same as in **My profile** / Learning Mode.

---

## Auto Grader

Auto Grader compares a **question** file (homework or exam) to your **answer** file. Both are usually **PDF** or **image** (see limits on the page and in the backend).

1. Open **Auto Grader** from the top bar.
2. **Choose question** and **Choose answer** (you need **both**).
3. **Start grading** and wait until it finishes.
4. Read **per-question** scores and any **total** shown.

If it fails, read the **red** error (missing file, network, file too large, server error). Try smaller PDFs or images. Use this for **quick feedback** on written work; full lessons with the textbook are in **Learning Mode**.

---

## My profile

Only when **signed in** (otherwise the app opens sign-in).

**Account:** avatar, name, email, **Sign out**.

**Textbooks**

- **Current textbook** dropdown: **FCOS (built-in)** and **PDFs you uploaded**. This controls the outline and PDF used in **Learning Mode** and **`/learning-bar`**.
- **Delete** an uploaded book (permanent: PDF, outline, and **progress data** for that book on the server)—not for built-in FCOS.
- **Sync textbook list with server** if labels look wrong.
- **Clear uploaded books from this browser only** clears local cache for your uploads; **FCOS** remains—then **Sync** again to reload.
- **Upload new textbook (PDF):** the server checks that the file is a real **textbook**; if rejected, that flow is for course books only—**Auto Grader** is for arbitrary homework PDFs. While processing, you may see **“Building outline…”**

**Appearance:** a **color preset** adjusts **page background** and the **chat panel** in Learning Mode. Stored in your app/browser profile per implementation.

**Product tour:** **Restart tour** replays the Learning Mode walkthrough (outline, history, chat).

**After changing or uploading a book,** open **Learning Mode** again so the new outline and pages apply.

---

## Common questions and issues

| Question / issue | What to do |
|------------------|------------|
| **Do I need an account?** | No for Learning Mode and Auto Grader. Yes for cloud sync, saved history (if deployed), and My profile. |
| **“Pages 145–160” vs “Page 3 of 12”** | The first = **printed** range. “Page 3 of 12” = **3rd image** of 12 in **this** batch, not a printed page. |
| **Book didn’t switch after upload** | Check **My profile** → current textbook, then re-open **Learning Mode**. **Sync** the list if it looks broken. |
| **Grader says error** | You must provide **both** files; read the red message. Check size and format. |
| **App can’t reach API / mixed content** | Needs correct HTTPS and API URL; ask the administrator. |
| **Chinese 界面说明** | 仓库内 `docs/learning-mode-user.md` |
| **Developers (API, env, code map)** | `docs/learning-mode-dev.md` / `docs/learning-mode-dev-en.md` |

---

*If the live deployment differs from this document, follow the on-screen UI and your host’s support.*
