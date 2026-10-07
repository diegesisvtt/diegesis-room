import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { runMigrations } from "./db/client";
import { seed } from "./lib/seed";
import { campaignsRoutes } from "./modules/campaigns/routes";
import { channelsRoutes, channelRoutes } from "./modules/channels/routes";
import { invitesRoutes } from "./modules/invites/routes";
import { profilesRoutes } from "./modules/profiles/routes";
import { roomsRoutes } from "./modules/rooms/routes";
import { chatRoutes, chatWs } from "./modules/chat/routes";
import { settingsRoutes } from "./modules/settings/routes";

runMigrations();
await seed();

const app = new Elysia()
  .use(cors())
  .get("/api/health", () => ({ ok: true, time: Date.now() }))
  .use(chatWs)
  .group("/api", (api) =>
    api
      .use(campaignsRoutes)
      .use(channelsRoutes)
      .use(channelRoutes)
      .use(invitesRoutes)
      .use(profilesRoutes)
      .use(roomsRoutes)
      .use(chatRoutes)
      .use(settingsRoutes),
  );
// In production, serve the built web assets (relative to the project root).
const dist = resolve(process.cwd(), "dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

// Serve the built web assets when they exist (production mode). In development
// the Vite dev server on :5173 serves the frontend and proxies /api + /ws here.
if (existsSync(dist)) {
  app.get("*", async ({ request, set }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws")) {
      set.status = 404;
      return "Not found";
    }

    // Sanitize the path to avoid traversal and map "/" to index.html.
    const segments = decodeURIComponent(url.pathname).split("/").filter((s) => s && s !== "." && s !== "..");
    const rel = segments.length === 0 ? "index.html" : segments.join("/");
    let filePath = join(dist, rel);

    if (!filePath.startsWith(dist)) filePath = join(dist, "index.html");

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      set.headers["content-type"] = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
      return Bun.file(filePath);
    }

    // SPA fallback for client-side routes.
    set.headers["content-type"] = MIME[".html"]!;
    return Bun.file(join(dist, "index.html"));
  });
}

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`[diegesis-room] server listening on http://localhost:${port}`);
});
