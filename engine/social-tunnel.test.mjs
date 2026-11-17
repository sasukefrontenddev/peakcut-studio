import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createMediaGateway } from "./social-tunnel.mjs";
const listen = (s) =>
  new Promise((r) => s.listen(0, "127.0.0.1", () => r(s.address().port)));
const close = (s) =>
  new Promise((r) => {
    s.close(r);
    s.closeAllConnections();
  });
test("public relay exposes no API, account setup, OAuth starts, dashboard or arbitrary files", async () => {
  const seen = [];
  const engine = http.createServer((req, res) => {
    seen.push(req.url);
    res.writeHead(404).end("Invalid signed link");
  });
  const enginePort = await listen(engine);
  const gateway = createMediaGateway({
    backendURL: `http://127.0.0.1:${enginePort}`,
  });
  const port = await listen(gateway),
    base = `http://127.0.0.1:${port}`;
  try {
    for (const path of [
      "/api/status",
      "/api/apps",
      "/app",
      "/oauth/instagram/start",
      "/media/test.mp4",
      "/pub/../api/apps",
      "/pub/%2e%2e/api/apps",
      "/pub/a.b.mp4?other=1",
    ])
      assert.equal((await fetch(base + path)).status, 404);
    assert.equal((await fetch(base + "/healthz")).status, 200);
    assert.equal(seen.length, 0);
    const signed = "/pub/dGVzdA." + "a".repeat(24) + ".mp4";
    assert.equal((await fetch(base + signed)).status, 404);
    assert.deepEqual(seen, [signed]);
    assert.equal(
      (await fetch(base + signed, { method: "POST", body: "untrusted" }))
        .status,
      404,
    );
    assert.equal(seen.length, 1);
  } finally {
    await close(gateway);
    await close(engine);
  }
});
