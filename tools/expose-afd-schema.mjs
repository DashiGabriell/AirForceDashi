/**
 * @deprecated Schema canônico é public.afd_* em supabase/migrations/.
 * Este script só recarrega o PostgREST após migrate.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const map = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);

const url = map.SUPABASE_URL || map.VITE_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
if (!ref || !map.SUPABASE_TOKEN) {
  console.error("MISSING_ENV");
  process.exit(1);
}

console.warn(
  "[deprecated] prefer: npx supabase db push · schema = public.afd_*",
);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${map.SUPABASE_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: "notify pgrst, 'reload schema';" }),
  },
);
const text = await res.text();
if (!res.ok) {
  console.error("SQL_HTTP", res.status, text.slice(0, 400));
  process.exit(1);
}
console.log("PGRST_RELOAD_OK");
