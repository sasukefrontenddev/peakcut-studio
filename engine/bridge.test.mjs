import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createBridge } from "./bridge.mjs";

const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server.address().port)),
  );
const close = (server) =>
  new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
test("only the approved Studio can send commands or read local video data", async () => {
  let called = 0;
  const upstream = http.createServer((req, res) => {
    called++;
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () =>
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(
          JSON.stringify({ body, origin: req.headers.origin, path: req.url }),
        ),
    );
  });
  const upstreamPort = await listen(upstream);
  const token = "this-is-a-test-key-not-a-real-secret";
  const bridge = createBridge({
    token,
    backendURL: `http://127.0.0.1:${upstreamPort}`,
    origins: ["https://peakcut-studio-chi.vercel.app"],
  });
  const port = await listen(bridge),
    base = `http://127.0.0.1:${port}`;
  try {
    for (const origin of [
      null,
      "https://evil.example",
      "https://peakcut-studio-chi.vercel.app.evil.example",
    ]) {
      const r = await fetch(base + "/api/jobs", {
        method: "POST",
        headers: origin ? { Origin: origin } : {},
        body: "untrusted",
      });
      assert.equal(r.status, 403);
    }
    assert.equal(called, 0);
    let r = await fetch(base + "/api/jobs", {
      method: "OPTIONS",
      headers: {
        Origin: "https://peakcut-studio-chi.vercel.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Private-Network": "true",
      },
    });
    assert.equal(r.status, 204);
    assert.equal(
      r.headers.get("access-control-allow-origin"),
      "https://peakcut-studio-chi.vercel.app",
    );
    assert.equal(r.headers.get("access-control-allow-private-network"), "true");
    assert.equal(called, 0);
    for (const key of ["", "wrong-key", "é".repeat(token.length)]) {
      const denied = await fetch(base + "/api/jobs", {
        headers: {
          Origin: "https://peakcut-studio-chi.vercel.app",
          Authorization: "Bearer " + key,
        },
      });
      assert.equal(denied.status, 401);
    }
    assert.equal(called, 0);
    r = await fetch(base + "/api/jobs", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Origin: "https://peakcut-studio-chi.vercel.app",
        "Content-Type": "application/json",
      },
      body: '{"title":"test"}',
    });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), {
      body: '{"title":"test"}',
      origin: `http://127.0.0.1:${upstreamPort}`,
      path: "/api/jobs",
    });
    r = await fetch(base + "/anything", {
      headers: {
        Authorization: "Bearer " + token,
        Origin: "https://peakcut-studio-chi.vercel.app",
      },
    });
    assert.equal(r.status, 404);
    assert.equal(called, 1);
    const rebound = await new Promise((resolve, reject) => {
      http
        .get(
          base + "/api/status",
          {
            headers: {
              Host: `rebound.example:${port}`,
              Origin: "https://peakcut-studio-chi.vercel.app",
            },
          },
          (r) => {
            r.resume();
            r.on("end", () => resolve(r.statusCode));
          },
        )
        .on("error", reject);
    });
    assert.equal(rebound, 403);
    assert.equal(called, 1);
  } finally {
    await close(bridge);
    await close(upstream);
  }
});
