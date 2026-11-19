import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(import.meta.dirname, "../.env");
const raw = fs.readFileSync(envPath, "utf8");
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  if (process.env[m[1]] != null) continue;
  process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
