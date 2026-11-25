/**
 * Entry serverless — monta a economy API sob `/api/*` na Vercel.
 * Dev local continua em `src/index.ts` (porta 8787, sem prefixo).
 */
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { createApiApp } from "./app";

const { app: economy } = createApiApp();

const app = new Hono();
app.route("/api", economy);

export default handle(app);
