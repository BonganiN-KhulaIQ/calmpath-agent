import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleTurnRequest, TurnRequestError } from "./src/server/turnHandler";

/**
 * Serves POST /api/turn during `npm run dev` by calling the exact same
 * framework-independent handler the deployed Vercel function uses
 * (src/server/turnHandler.ts). This exists purely so local development
 * keeps working with the same `npm run dev` command as before the backend
 * split — no separate local server or Vercel CLI is required to try the
 * app end-to-end on your own machine. It is dev-only: this plugin is not
 * part of the production build, and Vercel serves api/turn.ts directly.
 */
function calmpathApiDevPlugin(): Plugin {
  return {
    name: "calmpath-api-dev",
    configureServer(server) {
      server.middlewares.use("/api/turn", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        let raw = "";
        req.on("data", (chunk) => {
          raw += chunk;
        });
        req.on("end", async () => {
          try {
            const body = raw.length > 0 ? JSON.parse(raw) : {};
            const result = await handleTurnRequest(body);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err) {
            res.setHeader("Content-Type", "application/json");
            res.statusCode = err instanceof TurnRequestError ? 400 : 400;
            res.end(JSON.stringify({ error: "That message couldn't be sent." }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), calmpathApiDevPlugin()],
  test: {
    environment: "node",
    globals: true,
    env: {
      // A fixed, throwaway secret so the test suite doesn't hit the
      // "no secret set" dev-fallback warning path on every run. Never
      // used outside tests — real deployments set CALMPATH_SESSION_SECRET
      // in Vercel's project environment variables instead.
      CALMPATH_SESSION_SECRET: "vitest-fixed-test-secret-not-for-production-use",
    },
  },
});
