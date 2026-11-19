import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Keep in sync with M4_BUNDLE_BUDGET in packages/shared-types/src/index.ts */
const MAX_ENTRY_JS_BYTES = 1_550_000;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps/web/dist");
const assetsDir = path.join(dist, "assets");

async function listJs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...(await listJs(full)));
    } else if (e.name.endsWith(".js")) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  let jsFiles;
  try {
    jsFiles = await listJs(assetsDir);
  } catch {
    console.error(
      `[budget] Missing ${path.relative(root, assetsDir)} — run npm run build first.`,
    );
    process.exit(1);
  }

  if (jsFiles.length === 0) {
    console.error("[budget] No JS assets found in dist/assets.");
    process.exit(1);
  }

  let total = 0;
  const rows = [];
  for (const file of jsFiles) {
    const s = await stat(file);
    total += s.size;
    rows.push({ name: path.relative(dist, file), bytes: s.size });
  }
  rows.sort((a, b) => b.bytes - a.bytes);

  console.log("[budget] JS assets (raw, pre-gzip):");
  for (const r of rows) {
    console.log(`  ${(r.bytes / 1024).toFixed(1).padStart(8)} KB  ${r.name}`);
  }
  console.log(
    `  total ${(total / 1024).toFixed(1)} KB  /  limit ${(MAX_ENTRY_JS_BYTES / 1024).toFixed(0)} KB`,
  );

  if (total > MAX_ENTRY_JS_BYTES) {
    console.error(
      `[budget] FAIL — ${total} bytes > ${MAX_ENTRY_JS_BYTES} (M0 maxEntryJsBytes)`,
    );
    process.exit(1);
  }
  console.log("[budget] OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
