/**
 * 将 backend/data/FOCS.json 复制到 src/data/focsTree.json，供 My Learning Bar 内置目录。
 * 在 frontend 目录执行: npm run sync-focs
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
  console.error("源文件不存在:", src);
  process.exit(1);
}
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log("已同步:", dst);
