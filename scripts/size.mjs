import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const LIMIT = 3.25 * 1024;
const dist = new URL("../dist/", import.meta.url);

function bundle(file, seen = new Set()) {
  if (seen.has(file)) return "";
  seen.add(file);
  const code = readFileSync(new URL(file, dist), "utf8");
  const imports = [...code.matchAll(/from\s*"\.\/([^"]+)"/g)].map((m) => m[1]);
  return code + imports.map((dep) => bundle(dep, seen)).join("");
}

const bytes = gzipSync(bundle("index.js"), { level: 9 }).length;
console.log(`microkeys: ${bytes} B gzipped (limit ${LIMIT} B)`);
if (bytes > LIMIT) process.exit(1);
