import "./env";
import { serve } from "@hono/node-server";
import { createApiApp } from "./app";

const port = Number(process.env.PORT ?? 8787);
const { app, persist } = createApiApp();

serve({ fetch: app.fetch, port }, () => {
  console.log(
    `[afd-api] economy listening on http://localhost:${port}` +
      (persist ? " (supabase persist on)" : " (memory only)"),
  );
});
