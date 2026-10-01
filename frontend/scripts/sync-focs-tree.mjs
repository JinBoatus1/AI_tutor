/**
 * Copy backend/data/books/<id>/outline.json -> src/data/<id>Tree.json for every
 * builtin book, so the Learning bar trees stay bundled.
 * Run from frontend: npm run sync-focs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, "..");
const repoRoot = path.join(frontendRoot, "..");
const booksDir = path.join(repoRoot, "backend", "data", "books");

/** book id -> bundled tree filename (kept explicit so imports stay greppable). */
const TREE_FILE = { focs: "focsTree.json", lathi: "lathiTree.json" };

if (!fs.existsSync(booksDir)) {
  console.error("Books directory not found:", booksDir);
  process.exit(1);
}

let synced = 0;
for (const id of fs.readdirSync(booksDir).sort()) {
  const src = path.join(booksDir, id, "outline.json");
  const name = TREE_FILE[id];
  if (!name || !fs.existsSync(src)) continue;
  const dst = path.join(frontendRoot, "src", "data", name);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log("Synced:", dst);
  synced++;
}

if (synced === 0) {
  console.error("No builtin outlines synced — check TREE_FILE mapping.");
  process.exit(1);
}
