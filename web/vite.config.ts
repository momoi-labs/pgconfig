import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { guideMarkdown } from "./guideMarkdown.ts";

// `npm run dev` talks to a PGConfig server for everything the app does not
// serve itself: the REST API, the Swagger UI, the MCP endpoint and the
// parameter documentation.
const server = process.env.PGCONFIG_DEV_PROXY_TARGET ?? "http://localhost:3999";

// The server serves the build from its root and answers every path it does
// not know with index.html, so assets are addressed from /.
export default defineConfig({
  base: "/",
  plugins: [react(), guideMarkdown()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    // The guide's MCP page is ../docs/mcp.md, which lives outside this root.
    fs: {
      allow: [import.meta.dirname, resolve(import.meta.dirname, "../docs")],
    },
    proxy: Object.fromEntries(
      ["/v1", "/docs", "/mcp", "/parameters"].map((path) => [
        path,
        { target: server, changeOrigin: true },
      ]),
    ),
  },
});
