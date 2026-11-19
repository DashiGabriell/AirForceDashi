/**
 * Dev bootstrap for AirForceDashi Supabase project (from .env URL).
 * Resolves SUPABASE_URL + SERVICE_ROLE via Management API when possible.
 * Never prints secret values.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envPath = path.join(root, ".env");

function parseEnv(text) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    map[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return map;
}

const raw = fs.readFileSync(envPath, "utf8");
const map = parseEnv(raw);
const url = map.SUPABASE_URL || map.VITE_SUPABASE_URL;
if (!url) {
  console.error("NO_URL");
  process.exit(1);
}
const refMatch = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
if (!refMatch) {
  console.error("BAD_URL");
  process.exit(1);
}
const ref = refMatch[1];
console.log("PROJECT_REF", ref);

const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
let changed = false;

if (!map.SUPABASE_URL) {
  lines.push(`SUPABASE_URL=${url}`);
  console.log("WROTE_SUPABASE_URL");
  changed = true;
}

if (!map.SUPABASE_TOKEN) {
  console.log("NO_TOKEN_SKIP_KEYS");
  if (changed) fs.writeFileSync(envPath, `${lines.join("\n")}\n`);
  process.exit(0);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/api-keys`,
  {
    headers: {
      Authorization: `Bearer ${map.SUPABASE_TOKEN}`,
      Accept: "application/json",
    },
  },
);
const body = await res.text();
if (!res.ok) {
  console.log("KEYS_HTTP", res.status, body.slice(0, 160));
} else {
  /** @type {{ name: string, api_key?: string }[]} */
  const keys = JSON.parse(body);
  console.log("KEYS_OK", keys.map((k) => k.name).join(","));
  const svc = keys.find((k) => k.name === "service_role");
  if (svc?.api_key && !map.SUPABASE_SERVICE_ROLE_KEY) {
    lines.push(`SUPABASE_SERVICE_ROLE_KEY=${svc.api_key}`);
    console.log("WROTE_SERVICE_ROLE");
    changed = true;
  } else if (map.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("SERVICE_ROLE_ALREADY_PRESENT");
  } else {
    console.log("NO_SERVICE_ROLE");
  }
}

// Probe project status
const proj = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
  headers: {
    Authorization: `Bearer ${map.SUPABASE_TOKEN}`,
    Accept: "application/json",
  },
});
const projBody = await proj.text();
if (proj.ok) {
  const p = JSON.parse(projBody);
  console.log("PROJECT_STATUS", p.status, "NAME", p.name);
} else {
  console.log("PROJECT_HTTP", proj.status, projBody.slice(0, 160));
}

if (changed) fs.writeFileSync(envPath, `${lines.join("\n")}\n`);
console.log(
  "ENV_NAMES",
  parseEnv(fs.readFileSync(envPath, "utf8")) &&
    Object.keys(parseEnv(fs.readFileSync(envPath, "utf8"))).join(","),
);
