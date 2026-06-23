# Learning Mode — 开发 / 维护文档

面向 **开发者与运维**：接口、代码入口、部署与排错。用户使用说明见 [learning-mode-user.md](./learning-mode-user.md)。

**English:** [learning-mode-dev-en.md](./learning-mode-dev-en.md)

---

## 一、前后端职责

| 层级 | 职责 |
|------|------|
| 前端 `LearningModel.tsx` | 三栏布局、聊天、`/api/chat`、书页预览、`/api/textbook_pages`、顶栏书本页码展示 |
| 前端 `LearningBarPanel.tsx` | 左侧目录树、进度点、换书、本地/服务端进度同步 |
| 后端 `api_routes.py` | `/api/chat`、 `/api/textbook_pages`、 `matched_topic`（含 `start_book` / `end_book` 与 PDF 页）、简单定义早返回、`GET /api/version` |

---

## 二、关键 API

### 2.1 `POST /api/chat`

- 请求体：`message`, `history`, `student_id`, `session_id`, `textbook_id`, `images_b64`, `pdf_b64`, `silent` 等（见 `ChatMessage` 模型）。
- **简单定义问题**：在 `api_routes.py` 开头若命中 `_is_simple_definition_question`，**早返回**一句式回复，不跑 topic 匹配、章节树、memory、进度条写入等（以仓库当前实现为准）。
- 正常路径下 `matched_topic` 建议同时包含：
  - `start_book` / `end_book`：书本页码（与 `FOCS.json` 树一致）
  - `start_pdf` / `end_pdf` 或兼容字段 `start`/`end`（PDF 物理页，用于渲染）

### 2.2 `GET /api/textbook_pages`

- Query：`textbook_id`, `start_book`, `end_book`, `section_title`
- 返回：`pages_b64[]`，以及 `matched_topic`（同上，含书本页 + PDF 页）。

### 2.3 `GET /api/version`

- 用于确认 **Render** 等环境是否已部署到目标 commit：`RENDER_GIT_COMMIT`（若平台注入）。

---

## 三、前端环境变量

- **`VITE_API_URL`**（`frontend/src/apiBase.ts`）  
  - 未设置：请求走当前站点相对路径 `/api/...`（需反向代理或同源后端）。  
  - 设置：指向独立 API 域名；注意 HTTPS 页面不要配 `http://` API（混合内容会被浏览器拦截）。

---

## 四、部署（Render）

1. 将包含改动的分支 **push** 到 GitHub。  
2. 在 Render 触发 **Deploy** 并等待成功。  
3. 访问 `https://<你的服务>/api/version` 核对 `render_git_commit`。  
4. 用 DevTools → Network 确认浏览器里的 `/api/chat` **Request URL** 指向该服务。

---

## 五、故障排查

| 现象 | 检查项 |
|------|--------|
| 书页加载失败 | 服务器是否有教材 PDF、`/api/textbook_pages` 返回、`MAX_TEXTBOOK_PREVIEW_PAGES` 等 |
| 顶栏「Pages」与左侧树不一致 | 前后端是否都已包含 `start_book`/`end_book`；CDN/浏览器缓存 |
| 简单定义仍返回长文 | 线上是否已部署含早返回的 `api_routes.py`；请求是否打到正确 host |
| 前端连错 API | `VITE_API_URL` 构建值、生产环境是否误用 localhost |

---

## 六、代码入口（速查）

- `frontend/src/LearningModel.tsx` — Learning Mode 主页面  
- `frontend/src/LearningBarPanel.tsx` — 左侧进度与目录  
- `frontend/src/learningTextbooks.ts` — 教材 ID、目录拉取  
- `backend/api_routes.py` — 上述路由与 prompt 组装  
- `backend/learning_resources.py` — PDF 偏移、topic 匹配、页码工具  

---

*实现细节以仓库内代码为准；本文仅作导航与运维备忘。*
