/**
 * @deprecated Use `node tools/apply-afd-migration.mjs` ou `npx supabase db push`.
 * Mantido como alias para não quebrar hábitos/CI antigos.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

console.warn(
  "[deprecated] apply-afd-public-tables → redirecionando para apply-afd-migration.mjs",
);
const r = spawnSync(
  process.execPath,
  [path.join(import.meta.dirname, "apply-afd-migration.mjs")],
  { stdio: "inherit" },
);
process.exit(r.status ?? 1);
