import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// These tests exercise api/turn.js, the committed bundle Vercel actually
// runs, loaded the way production loads it: as a native Node ES module. The
// un-bundled function crashed on Vercel with ERR_MODULE_NOT_FOUND because
// Node cannot resolve extensionless imports; nothing under test here could
// catch that, because Vitest resolves them itself.

const BUNDLE_URL = new URL("../api/turn.js", import.meta.url);
const KEYS = ["CALMPATH_SESSION_SECRET", "VERCEL_ENV"] as const;
const saved: Record<string, string | undefined> = {};

type Res = { code: number; body: unknown; status(c: number): Res; json(b: unknown): Res };
type Handler = (req: unknown, res: Res) => Promise<void>;

async function loadHandler(): Promise<Handler> {
  // A variable specifier keeps Vite from bundling it: Node loads the real file.
  const mod = (await import(/* @vite-ignore */ BUNDLE_URL.href)) as { default: Handler };
  return mod.default;
}

function fakeRes(): Res {
  const res: Res = {
    code: 0,
    body: undefined,
    status(c) {
      res.code = c;
      return res;
    },
    json(b) {
      res.body = b;
      return res;
    },
  };
  return res;
}

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env["CALMPATH_SESSION_SECRET"] = "k".repeat(40);
  delete process.env["VERCEL_ENV"];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("api/turn.js (the deployed bundle)", () => {
  it("has no relative imports left for Node to fail on", () => {
    const source = readFileSync(BUNDLE_URL, "utf8");
    expect(source).not.toMatch(/from\s+["']\.{1,2}\//);
    expect(source).not.toMatch(/import\(\s*["']\.{1,2}\//);
    expect(source).not.toMatch(/\.json["']/);
  });

  it("loads under native Node and answers a plain greeting", async () => {
    const handler = await loadHandler();
    const res = fakeRes();
    await handler({ method: "POST", body: { text: "Hi", sessionToken: null } }, res);
    expect(res.code).toBe(200);
    const body = res.body as { tier: string; tool: string; sessionToken: string };
    expect(body.tier).toBe("T0");
    expect(body.tool).toBe("greeting_response");
    expect(body.sessionToken).toContain(".");
  });

  it("escalates a curly-apostrophe crisis message to T3 through the bundle", async () => {
    const handler = await loadHandler();
    const res = fakeRes();
    await handler(
      { method: "POST", body: { text: "I don’t want to be alive anymore.", sessionToken: null } },
      res,
    );
    const body = res.body as { tier: string; tool: string | null };
    expect(res.code).toBe(200);
    expect(body.tier).toBe("T3");
    expect(body.tool).toBeNull();
  });

  it("rejects non-POST with 405 and bad input with 400", async () => {
    const handler = await loadHandler();
    const get = fakeRes();
    await handler({ method: "GET" }, get);
    expect(get.code).toBe(405);
    const empty = fakeRes();
    await handler({ method: "POST", body: { text: "", sessionToken: null } }, empty);
    expect(empty.code).toBe(400);
  });

  it("answers 500 on a Preview deployment with no secret configured", async () => {
    const handler = await loadHandler();
    delete process.env["CALMPATH_SESSION_SECRET"];
    process.env["VERCEL_ENV"] = "preview";
    const res = fakeRes();
    await handler({ method: "POST", body: { text: "Hi", sessionToken: null } }, res);
    expect(res.code).toBe(500);
  });
});
