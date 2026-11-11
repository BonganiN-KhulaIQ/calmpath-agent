// Bundles the /api/turn function into ONE self-contained ES module: api/turn.js.
//
// Why: Vercel runs api/*.js as native Node ES modules (package.json has
// "type": "module"). Node's ESM loader cannot resolve the extensionless
// relative imports used throughout src/, nor JSON imports without import
// attributes, so the un-bundled function crashed with ERR_MODULE_NOT_FOUND.
// esbuild resolves all of that at build time and inlines zod and the
// resource JSON, leaving nothing for the runtime to resolve except node:crypto.
//
// api/turn.js is committed on purpose (Vercel discovers functions from the
// repository, not from files generated during the build). CI re-runs this
// script and fails if the committed file differs.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [resolve(root, "src/server/turnApi.ts")],
  outfile: resolve(root, "api/turn.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // zod is a real dependency and ships proper ES modules, so Vercel installs it
  // and Node loads it natively. Keeping it external keeps this committed file
  // small enough to read.
  external: ["zod", "zod/*"],
  legalComments: "none",
  logLevel: "info",
  banner: {
    js:
      "// GENERATED FILE - DO NOT EDIT. Source: src/server/turnApi.ts.\n" +
      "// Rebuild with `npm run build:api`. See scripts/build-api.mjs for why this exists.",
  },
});
