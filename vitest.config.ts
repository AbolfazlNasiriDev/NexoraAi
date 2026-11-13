/**
 * Vitest config (Phase 2.8).
 *
 * - `@/*` alias mirrors tsconfig.json so tests import the same way the
 *   app does.
 * - Node environment: the tests cover server-side logic only; no DOM,
 *   no browser, no network.
 * - `server-only` resolution: the package ships two files — `index.js`
 *   (throws, for client bundles) and `empty.js` (a no-op, for server
 *   code) — selected by its OWN `react-server` export condition, the
 *   exact condition Next.js applies when bundling React Server
 *   Components. In Vite 6 the SSR conditions live under
 *   `ssr.resolve.conditions` (top-level `resolve.conditions` only
 *   affects the client environment), so that is where it is set here,
 *   and `server-only` is inlined so vite-node runs it through Vite's
 *   resolver instead of Node's native loader. This is NOT a mock: no
 *   test double is involved, the package's real files are used, and
 *   the guard still throws for client-side resolution (the default
 *   condition). Verified by probe: with default resolution every
 *   server-only import throws "This module cannot be imported from a
 *   Client Component module." (see docs/testing.md).
 */
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  ssr: {
    resolve: {
      conditions: ["react-server"],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    server: {
      deps: {
        inline: ["server-only"],
      },
    },
  },
});
