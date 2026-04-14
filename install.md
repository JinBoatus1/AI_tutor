# Installation Guide / 安装指南

> **Scope:** This document describes the **main app** — **FastAPI backend** (`backend/`) + **Vite/React frontend** (`frontend/`), started with **`python init.py`**.  
> It does **not** cover the optional **Streamlit** prototype file `Demo` (that needs `pip install streamlit` and `streamlit run Demo` separately).

---

## 简体中文

### 环境准备

1. 安装 [Conda](https://docs.conda.io/en/latest/miniconda.html)（Miniconda/Anaconda），在**项目根目录**执行：

   ```powershell
   conda env create -f environment.yml
   conda activate py312-api
   ```

   若环境已存在但需要同步依赖变更，可使用：

   ```powershell
   conda env update -f environment.yml --prune
   ```

2. **不用 Conda** 时，可在任意 Python 3.12+ 虚拟环境中安装后端依赖：

   ```powershell
   cd backend
   pip install -r requirements.txt
   ```

   `requirements.txt` 包含 FastAPI、uvicorn、openai、PyMuPDF 等（与 `environment.yml` 中 pip 列表一致；以仓库内文件为准）。

### 教材数据（Learning Mode 必需）

将 **FOCS 教材 PDF** 放到 `backend/data/`，默认文件名为 **`FOCS.pdf`**（或与 `backend/learning_resources.py` 中逻辑一致的首个 `.pdf`）。目录结构 **`backend/data/FOCS.json`** 需与仓库一并存在，用于章节树与页码匹配。

### 环境变量

复制示例文件并填入 **OpenAI API Key**（二选一或同时设置均可；代码优先读取 `OPENAI_API_KEY`）：

```powershell
cd backend
copy .env.example .env
# 编辑 backend/.env：设置 OPENAI_API_KEY=sk-...（推荐），或 API_KEY=...
```

### Node.js（前端，可选便携安装）

若本机未装 Node，可下载 [Node.js Windows ZIP](https://nodejs.org/dist/)（例如 `node-v24.x.x-win-x64`），解压到 **`frontend/node.js/`**，保留其中的 **`npm.cmd`**。`init.py` 会自动查找并用于 `npm install` / `npm run dev`。

已全局安装 Node 时可直接使用 PATH 中的 `npm`。

### 启动（推荐）

在**仓库根目录**：

```powershell
python init.py
```

- 首次运行会在 `frontend/` 执行 **`npm install`**（之后可加 **`--skip-npm-install`** 跳过）。
- 可指定 npm：**`python init.py --npm-path "C:\path\to\npm.cmd"`**
- 同一终端会启动 **后端**（`uvicorn`，默认 `http://127.0.0.1:8000`）和 **前端**（Vite 开发服务器，通常为 `http://127.0.0.1:5173`）。**Ctrl+C** 结束两者。

### 可选：OCR / 图像

若使用依赖 **Tesseract** 的代码路径（如部分 PDF 文本提取），需在 Windows 上单独安装 [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) 并配置 PATH；多数 FOCS 文字版 PDF 仅用 PyMuPDF 即可。

---

## English

### Environment

1. Install [Conda](https://docs.conda.io/en/latest/miniconda.html), then from the **repo root**:

   ```powershell
   conda env create -f environment.yml
   conda activate py312-api
   ```

   To refresh an existing env from the file:

   ```powershell
   conda env update -f environment.yml --prune
   ```

2. **Without Conda**, use Python **3.12+** and:

   ```powershell
   cd backend
   pip install -r requirements.txt
   ```

### Textbook data (required for full Learning Mode)

Place the **FOCS PDF** under `backend/data/` (default name **`FOCS.pdf`**). Keep **`backend/data/FOCS.json`** in sync with the repo for the chapter tree and page ranges.

### Environment variables

```powershell
cd backend
copy .env.example .env
# Edit backend/.env — set OPENAI_API_KEY (recommended) and/or API_KEY
```

### Node.js (optional portable layout)

Extract a Windows Node ZIP under **`frontend/node.js/`** so **`npm.cmd`** exists there, or use a system-wide Node on `PATH`.

### Run (recommended)

From the **repository root**:

```powershell
python init.py
```

- First run: **`npm install`** in `frontend/` (later: **`--skip-npm-install`**).
- Optional: **`python init.py --npm-path "C:\path\to\npm.cmd"`**
- Starts **Uvicorn** (backend, e.g. `http://127.0.0.1:8000`) and **Vite** (frontend, e.g. `http://127.0.0.1:5173`). **Ctrl+C** stops both.

### Optional: Tesseract

Some OCR fallbacks expect a system **Tesseract** install on `PATH`; many workflows only need PyMuPDF for text PDFs.

---

*Last reviewed: 2026-04 (align with `environment.yml`, `backend/requirements.txt`, `backend/.env.example`, and `init.py`.)*
