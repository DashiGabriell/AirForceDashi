/**
 * Aplica supabase/migrations/*.sql no projeto cloud (Management API).
 * Preferível: `npx supabase db push` com CLI linkada.
 * Nunca imprime secrets.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
  );
}

const map = loadEnv();
const url = map.SUPABASE_URL || map.VITE_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
if (!ref || !map.SUPABASE_TOKEN) {
  console.error("MISSING_ENV (precisa SUPABASE_URL + SUPABASE_TOKEN)");
  process.exit(1);
}

if (!fs.existsSync(migrationsDir)) {
  console.error("MISSING_MIGRATIONS_DIR", migrationsDir);
  process.exit(1);
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (!files.length) {
  console.error("NO_MIGRATIONS");
  process.exit(1);
}

console.log("MIGRATE_REF", ref);
console.log("FILES", files.join(", "));

async function runQuery(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${map.SUPABASE_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SQL_HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return text;
}

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  console.log("APPLY", file);
  await runQuery(sql);
  console.log("OK", file);
}

const checkBody = await runQuery(
  `select table_name from information_schema.tables
   where table_schema = 'public' and table_name like 'afd_%'
   order by 1`,
);
const tables = JSON.parse(checkBody);
console.log(
  "TABLES",
  Array.isArray(tables)
    ? tables.map((r) => r.table_name || r.tablename).join(",")
    : "ok",
);
console.log("MIGRATION_OK");
