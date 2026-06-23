# Learning Mode — User guide

For **end users**: how to use the UI and understand page numbers vs chat. Technical details: [learning-mode-dev-en.md](./learning-mode-dev-en.md).

**中文版：** [learning-mode-user.md](./learning-mode-user.md)

---

## 1. Layout overview

Learning Mode is usually split into three columns:

| Area | Purpose |
|------|---------|
| **Left** | **Learning progress**: outline tree + learned / not learned |
| **Center** | **Textbook panel**: page preview, paging, hide |
| **Right** | **Chat**: questions, replies, images, PDFs, screenshots (when allowed) |

Use the top nav for Home, Auto Grader, My profile, etc.

---

## 2. Left: Learning progress

- Tree of **chapter → section** for the current book (e.g. FCOS).  
- Numbers in parentheses are **printed book page numbers** (same as the textbook TOC).

**Dots:** solid green = learned; hollow = not learned. Click to toggle.

**Section titles with page ranges:** click the title to open that range in the **center** preview (use Prev/Next for multiple pages).

**Expand all / Collapse all** and **sidebar collapse** help with long outlines and screen space.

---

## 3. Center: Textbook panel

- **Textbook:** matched section name (matches the tree).  
- **Pages:** **printed book page range** (same as the left tree), not raw PDF file page index.

**“Page x of y”** under Prev/Next means image **x** of **y** in the **current preview batch**, not the book’s printed page number.

**Hide** hides the panel; use **Show textbook sidebar** in chat when needed.

Some images open larger on click (lightbox).

---

## 4. Right: Chat

Ask in plain language; attach images or PDFs; use screenshot when supported.

Mentioning sections (e.g. `5.1`, `Chapter 11`) helps. You can also open pages from the **left** first, then ask about them.

**“I already fully understand — Start a new question”** resets the session for a new topic or problem.

For very short questions like “what is induction”, you may get a **one-sentence** answer. If you always get long structured replies, contact your project maintainer (it may depend on the deployed version or configuration).

---

## 5. Example flows

**A — From the tree:** find section → click title → preview in center → ask on the right → update dots.

**B — Ask first:** type or paste on the right → if a section matches, center header and pages update → use Prev/Next.

---

## 6. Sign-in and data

Without an account, Learning Mode often still works; progress may stay on the device. Signed-in behavior depends on server and Firebase setup (see `docs/firebase.md` or your maintainer).

---

*If the live UI differs from this guide, trust the deployed product.*
