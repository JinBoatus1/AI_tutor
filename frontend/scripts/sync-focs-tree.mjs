/**
 * Copy backend/data/FOCS.json -> src/data/focsTree.json for the bundled Learning bar tree.
 * Run from frontend: npm run sync-focs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, "..");
const repoRoot = path.join(frontendRoot, "..");
const src = path.join(repoRoot, "backend", "data", "FOCS.json");
const dst = path.join(frontendRoot, "src", "data", "focsTree.json");

if (!fs.existsSync(src)) {
  console.error("Source file not found:", src);
  process.exit(1);
}
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log("Synced:", dst);
