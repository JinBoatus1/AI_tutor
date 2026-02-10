# Utility to run both backend and frontend in parallel using available tooling.
import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent


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
	# check subdirectories such as node-v24.13.0-win-x64
	for child in node_root.iterdir():
		if not child.is_dir():
			continue
		candidate = child / "npm.cmd"
		if candidate.is_file():
			return candidate
	return None


def find_env_npm() -> Path | None:
	npm_name = "npm.cmd" if os.name == "nt" else "npm"
	for env_var in ("NODE_HOME", "NODEJS_HOME", "NVM_HOME"):
		node_dir = os.environ.get(env_var)
		if not node_dir:
			continue
		node_path = Path(node_dir)
		for candidate_dir in (node_path, node_path / "bin"):
			candidate = candidate_dir / npm_name
			if candidate.is_file():
				return candidate
	return None


def resolve_npm_path(user_path: str | None) -> Path:
	if user_path:
		path = Path(user_path)
		if not path.is_file():
			raise RuntimeError(f"Specified npm path does not exist: {path}")
		return path

	env_npm = find_env_npm()
	if env_npm:
		return env_npm

	local = find_local_npm()
	if local:
		return local

	which = shutil.which("npm")
	if which:
		return Path(which)

	raise RuntimeError(
		"npm executable not available. Please extract Node.js into frontend/node.js or install Node.js and add npm to PATH."
	)


def ensure_npm_deps(frontend_dir: Path, skip_install: bool, npm_exec: Path):
	if skip_install:
		return
	print("Installing frontend dependencies (npm install)")
	subprocess.run([str(npm_exec), "install"], cwd=frontend_dir, check=True)


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

	npm_exec = resolve_npm_path(args.npm_path)
	ensure_npm_deps(frontend_dir, args.skip_npm_install, npm_exec)

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
	backend_proc = run(backend_cmd, cwd=backend_dir)
	print("Launching frontend (npm run dev)")
	frontend_proc = run(frontend_cmd, cwd=frontend_dir)

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