# Utility to run both backend and frontend in parallel using available tooling.
import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def load_env_file(path: Path) -> dict[str, str]:
	values: dict[str, str] = {}
	if not path.is_file():
		return values
	for raw_line in path.read_text(encoding="utf-8").splitlines():
		line = raw_line.strip()
		if not line or line.startswith("#") or "=" not in line:
			continue
		key, value = line.split("=", 1)
		key = key.strip()
		value = value.strip().strip('"').strip("'")
		if key:
			values[key] = value
	return values


def mask_secret(secret: str) -> str:
	if len(secret) < 12:
		return "<too-short>"
	return f"{secret[:7]}...{secret[-4:]}"


def build_backend_env() -> dict[str, str]:
	env = dict(os.environ)
	root_env = load_env_file(ROOT / ".env")
	backend_env = load_env_file(ROOT / "backend" / ".env")

	for key, value in {**root_env, **backend_env}.items():
		env.setdefault(key, value)

	api_key = env.get("OPENAI_API_KEY") or env.get("API_KEY")
	if api_key:
		normalized = api_key.strip().strip('"').strip("'")
		env["OPENAI_API_KEY"] = normalized
		print(f"Detected OpenAI key: {mask_secret(normalized)}")
	else:
		print("Warning: OPENAI_API_KEY/API_KEY not found in environment, .env, or backend/.env")

	return env


def run(command, cwd=None, env=None):
	"""Start a subprocess and keep it running until interrupted."""
	return subprocess.Popen(
		command,
		cwd=cwd,
		env=env,
		shell=False,
	)


def find_local_npm() -> Path | None:
	node_root = ROOT / "frontend" / "node.js"
	if not node_root.exists():
		return None
	# direct npm.cmd inside node.js
	candidate = node_root / "npm.cmd"
	if candidate.is_file():
		return candidate
	# check subdirectories such as node-v24.14.0-win-x64 (prefer newer names)
	for child in sorted(node_root.iterdir(), key=lambda p: p.name, reverse=True):
		if not child.is_dir():
			continue
		candidate = child / "npm.cmd"
		if candidate.is_file():
			return candidate
	return None


def can_run_npm(npm_exec: Path) -> bool:
	if not npm_exec.is_file():
		return False
	try:
		result = subprocess.run(
			[str(npm_exec), "--version"],
			stdout=subprocess.DEVNULL,
			stderr=subprocess.DEVNULL,
			check=False,
		)
		return result.returncode == 0
	except OSError:
		return False


def find_env_npm() -> Path | None:
	npm_name = "npm.cmd" if os.name == "nt" else "npm"
	for env_var in ("NODE_HOME", "NODEJS_HOME", "NVM_SYMLINK", "NVM_HOME", "VOLTA_HOME"):
		node_dir = os.environ.get(env_var)
		if not node_dir:
			continue
		node_path = Path(node_dir)
		for candidate_dir in (node_path, node_path / "bin"):
			candidate = candidate_dir / npm_name
			if candidate.is_file():
				return candidate
	return None


def find_path_npm() -> Path | None:
	for name in ("npm.cmd", "npm") if os.name == "nt" else ("npm",):
		which = shutil.which(name)
		if which:
			return Path(which)
	return None


def find_npm_near_node() -> Path | None:
	node_exec = shutil.which("node.exe" if os.name == "nt" else "node")
	if not node_exec:
		return None
	node_dir = Path(node_exec).parent
	npm_name = "npm.cmd" if os.name == "nt" else "npm"
	candidate = node_dir / npm_name
	if candidate.is_file():
		return candidate
	return None


def resolve_npm_path(user_path: str | None) -> Path:
	if user_path:
		path = Path(user_path)
		if not path.is_file():
			raise RuntimeError(f"Specified npm path does not exist: {path}")
		if not can_run_npm(path):
			raise RuntimeError(f"Specified npm path is not runnable: {path}")
		return path

	for candidate in (
		find_env_npm(),
		find_path_npm(),
		find_npm_near_node(),
		find_local_npm(),
	):
		if candidate and can_run_npm(candidate):
			return candidate

	raise RuntimeError(
		"No runnable npm executable found. Checked NODE_HOME/NODEJS_HOME/NVM_SYMLINK/NVM_HOME/VOLTA_HOME, PATH, and frontend/node.js."
	)


def resolve_node_exec(npm_exec: Path) -> Path:
	if os.name != "nt":
		node = shutil.which("node")
		if node:
			return Path(node)
		raise RuntimeError("node executable not available on PATH")

	# Typical Node layout on Windows keeps node.exe next to npm.cmd
	for candidate in (
		npm_exec.parent / "node.exe",
		npm_exec.parent.parent / "node.exe",
	):
		if candidate.is_file():
			return candidate

	node = shutil.which("node.exe")
	if node:
		return Path(node)

	raise RuntimeError(
		f"node.exe not available for npm at {npm_exec}. Install Node or pass --npm-path that points to a Node bundle."
	)


def build_frontend_env(node_exec: Path) -> dict[str, str]:
	env = dict(os.environ)
	node_dir = str(node_exec.parent)
	path_value = env.get("PATH", "")
	if not path_value:
		env["PATH"] = node_dir
	elif node_dir.lower() not in {part.lower() for part in path_value.split(os.pathsep) if part}:
		env["PATH"] = f"{node_dir}{os.pathsep}{path_value}"
	return env


def ensure_npm_deps(frontend_dir: Path, skip_install: bool, npm_exec: Path, frontend_env: dict[str, str]):
	if skip_install:
		return
	print("Installing frontend dependencies (npm install)")
	subprocess.run([str(npm_exec), "install"], cwd=frontend_dir, env=frontend_env, check=True)


def main():
	parser = argparse.ArgumentParser(description="Start backend and frontend together.")
	parser.add_argument(
		"--skip-npm-install",
		action="store_true",
		help="Skip npm install to save time when deps are already cached.",
	)
	parser.add_argument("--npm-path", type=str, help="Path to npm executable.")
	args = parser.parse_args()

	backend_dir = ROOT / "backend"
	frontend_dir = ROOT / "frontend"
	backend_env = build_backend_env()

	npm_exec = resolve_npm_path(args.npm_path)
	node_exec = resolve_node_exec(npm_exec)
	frontend_env = build_frontend_env(node_exec)
	ensure_npm_deps(frontend_dir, args.skip_npm_install, npm_exec, frontend_env)

	backend_cmd = [
		sys.executable,
		"-m",
		"uvicorn",
		"main:app",
		"--reload",
		"--host",
		"127.0.0.1",
		"--port",
		"8000",
	]

	frontend_cmd = [str(npm_exec), "run", "dev"]

	print("Launching backend (uvicorn) in py312-api")
	backend_proc = run(backend_cmd, cwd=backend_dir, env=backend_env)
	print("Launching frontend (npm run dev)")
	frontend_proc = run(frontend_cmd, cwd=frontend_dir, env=frontend_env)

	try:
		while True:
			if backend_proc.poll() is not None:
				print("Backend exited, shutting down frontend")
				frontend_proc.terminate()
				break
			if frontend_proc.poll() is not None:
				print("Frontend exited, shutting down backend")
				backend_proc.terminate()
				break
			time.sleep(0.5)
	except KeyboardInterrupt:
		print("Interrupted, terminating subprocesses")
		backend_proc.terminate()
		frontend_proc.terminate()
		sys.exit(1)


if __name__ == "__main__":
	main()