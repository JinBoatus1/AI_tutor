   -# Installation Guide / 安装指南

   ## 简体中文（Simplified Chinese）
   ### 环境准备
   1. 先安装 Conda（Miniconda/Anaconda），然后在项目根运行：
      ```powershell
      conda env create -f environment.yml
      conda activate py312-api
      ```
      `environment.yml` 现在将 `PyMuPDF>=1.26.0` 作为依赖，Conda/pip 会自动下载一个支持 Python 3.12 的预编译 wheel，无需再手动安装 1.22.1 或编译源码。
   2. 如果你不通过 `conda env create`，也可以手动安装后端依赖：
      ```powershell
      cd backend
      pip install -r requirements.txt
      ```
      这个 `requirements.txt` 同样指向 `PyMuPDF>=1.26.0`，让 pip 选取与当前 Python 版本匹配的 wheel，并继续安装 `python-multipart` 等其他包。

   ### 环境变量
   复制后端的示例 env 文件并填入你的 OpenAI 密钥：
   ```powershell
   cd backend
   copy .env.example .env
   # 编辑 backend/.env，把 API_KEY 设置成你的密钥（例如 GPT-4 的秘钥）
   ```

   ### 本地 Node.js 运行时（可选）
   下载 https://nodejs.org/dist/ 中对应的 Windows ZIP 版（例如 node-v24.13.0-win-x64），解压到 `frontend/node.js/`，并保留其中的 `npm.cmd`。初始化脚本会自动发现该文件，并在启动前运行 `npm install`。

   ### 启动流程
   在仓库根目录运行：
   ```powershell
   python init.py
   ```
   - 首次运行会自动安装前端依赖（以后可加 `--skip-npm-install`），并检测 `npm.cmd` 位置。
   - 该脚本会在同一个窗口中并行启动后端（`uvicorn main:app --reload`）和前端（`npm run dev`），按 Ctrl+C 即可同时停止。

   ## English
   ### Environment preparation
   1. Install Conda (Miniconda/Anaconda) and run from the repo root:
      ```powershell
      conda env create -f environment.yml
      conda activate py312-api
      ```
      The environment file now installs `PyMuPDF>=1.26.0`, so Conda/Pip picks a wheel that already supports Python 3.12 or newer. There is no need to force-install 1.22.1 and build it from source.
   2. If you prefer to install manually, grab the backend dependencies separately:
      ```powershell
      cd backend
      pip install -r requirements.txt
      ```
      The requirements list also references `PyMuPDF>=1.26.0`, letting pip resolve a compatible wheel before installing `python-multipart` and the rest.

   ### Environment variables
   In the backend folder run:
   ```powershell
   cd backend
   copy .env.example .env
   # edit backend/.env and put your real API_KEY (e.g., your OpenAI key)
   ```

   ### Local Node.js runtime (optional)
   Download the corresponding Windows ZIP from https://nodejs.org/dist/ (for example, node-v24.13.0-win-x64), extract it to `frontend/node.js/`, and keep `npm.cmd` inside. The helper script will locate that `npm.cmd` and run `npm install` before starting the dev servers.

   ### Start everything
   Run from the repo root:
   ```powershell
   python init.py
   ```
   - The first invocation installs the frontend dependencies (later runs can use `--skip-npm-install`).
   - `init.py` launches Uvicorn (`main:app --reload`) and Vite (`npm run dev`) in the same terminal; Ctrl+C stops both services at once.   -# Installation Guide / 安装指南

   ## 简体中文（Simplified Chinese）
   ### 清理环境（Reset environment）
   1. 下载并安装 Conda（Miniconda 或 Anaconda），在项目根运行：
      ```powershell
      conda env create -f environment.yml
      conda activate py312-api
      ```
   2. 进入 backend 目录并补 install 额外依赖，这会安装 `PyMuPDF` / `python-multipart` 等所有后端包：
      ```powershell
      cd backend
      pip install -r requirements.txt
      ```
   3. 在 `backend` 目录复制环境变量模板并填入你的 OpenAI API Key（与上一步在同一路径下）：
      ```powershell
      copy .env.example .env
      # 将 backend/.env 中的 API_KEY 替换为你的密钥
      ```
   4. 访问 https://nodejs.org/dist/ 下载对应的 Windows ZIP 版（如 node-v24.13.0-win-x64），解压到 `frontend/node.js/`（保留 npm.cmd）即可让项目使用本地版本的 Node。可选地将 `npm.cmd` 路径传给 `python init.py --npm-path "..."`。

   ### 启动流程
   在项目根运行：
   ```powershell
   python init.py
   ```
   首次运行会自动执行 `npm install`，之后可加 `--skip-npm-install` 跳过安装。如果你用的是 `frontend/node.js/.../npm.cmd`，`init.py` 会自动找到它，并在同一窗口同时启动后端（`uvicorn`）和前端（Vite）。按 Ctrl+C 可同时停止两边服务。

   ## English
   ### Reset the environment
   1. Install Conda (Miniconda/Anaconda) then execute:
      ```powershell
      conda env create -f environment.yml
      conda activate py312-api
      ```
   2. From the backend folder install the rest of its dependencies (PyMuPDF, python-multipart, etc.):
      ```powershell
      cd backend
      pip install -r requirements.txt
      ```
   3. Still inside backend, copy the example env file and fill in your OpenAI key:
      ```powershell
      copy .env.example .env
      # edit backend/.env and set API_KEY to your actual secret
      ```
   4. Download the Windows ZIP release of Node.js (e.g., node-v24.13.0-win-x64) from https://nodejs.org/dist/, extract it into `frontend/node.js/`, and keep `npm.cmd` inside that folder so the project can reuse the bundled Node runtime.

   ### Start everything
   Run from the repository root:
   ```powershell
   python init.py
   ```
   The helper will install frontend dependencies (omit with `--skip-npm-install` later), detect the local `npm.cmd`, and then launch Uvicorn and Vite side by side. Use `--npm-path "path\to\npm.cmd"` if you prefer to point to another Node release; Ctrl+C stops both servers.
