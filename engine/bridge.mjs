import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";

export const studioOrigins = [
  "https://peakcut-studio-chi.vercel.app",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];

// This server only listens on loopback. Only the named Studio origins can use it.
export function createBridge({
  backendURL = "http://127.0.0.1:8765",
  origins = studioOrigins,
  token,
} = {}) {
  if (typeof token !== "string" || token.length < 32)
    throw new Error("A private pairing key is required.");
  const backend = new URL(backendURL);
  if (
    backend.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(backend.hostname)
  ) {
    throw new Error("The video engine must be on this computer.");
  }
  const allowed = new Set(origins);
  const server = http.createServer((req, res) => {
    let address;
    try {
      address = new URL(`http://${req.headers.host}`);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (
      !["127.0.0.1", "localhost"].includes(address.hostname) ||
      Number(address.port) !== req.socket.localPort
    ) {
      res.writeHead(403).end("Open the engine by its local address.");
      return;
    }
    if (req.url === "/healthz" && req.method === "GET") {
      res
        .writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        })
        .end('{"ok":true}');
      return;
    }
    if (req.url === "/" && req.method === "GET") {
      const nonce = randomBytes(16).toString("base64");
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`,
        "X-Content-Type-Options": "nosniff",
      });
      res.end(
        `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PeakCut Engine</title><style>body{background:#faf9f6;color:#292c25;font:16px/1.8 system-ui;max-width:560px;padding:12vh 30px;margin:auto}span{color:#e8755e}h1{font-size:38px;letter-spacing:-1.5px}p{color:#7c8570}button{display:inline-block;background:#e8755e;color:white;border:0;border-radius:9px;padding:13px 20px;font:inherit;cursor:pointer;margin-top:20px}small{display:block;color:#929c84;margin-top:30px}</style><h1>Your computer.<br>Your creative engine<span>.</span></h1><p>Connect your PeakCut Studio website to this computer. This lets the site manage your videos and clips while this engine is running. Your files and AI key stay on this computer.</p><button id="connect">Connect PeakCut Studio ↗</button><p id="status" role="status"></p><small>This pairs only <strong>peakcut-studio-chi.vercel.app</strong> with this engine. Your private pairing key stays in this browser and on this computer. If your browser asks, allow the site to connect to your local network.</small><script nonce="${nonce}">let studio;document.getElementById('connect').onclick=()=>{studio=window.open('https://peakcut-studio-chi.vercel.app/?connect-local=1','peakcut-studio');document.getElementById('status').textContent='Opening your studio…';};window.addEventListener('message',e=>{if(e.origin!=='https://peakcut-studio-chi.vercel.app'||e.source!==studio||e.data?.type!=='peakcut-studio-ready')return;studio.postMessage({type:'peakcut-engine-pair',token:${JSON.stringify(token)}},'https://peakcut-studio-chi.vercel.app');document.getElementById('status').textContent='Paired. Keep the engine running while you create.';});</script></html>`,
      );
      return;
    }
    const origin = req.headers.origin;
    if (!allowed.has(origin)) {
      res
        .writeHead(403, { "Content-Type": "application/json" })
        .end(
          '{"detail":"This website is not allowed to use your video engine."}',
        );
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, HEAD, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Range, If-Range, If-None-Match",
    );
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Disposition, Content-Range, Accept-Ranges",
    );
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    res.setHeader("Access-Control-Max-Age", "600");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    const provided = String(req.headers.authorization || "").replace(
      /^Bearer /,
      "",
    );
    const actual = Buffer.from(provided),
      expected = Buffer.from(token);
    const validKey =
      actual.length === expected.length && timingSafeEqual(actual, expected);
    if (!validKey) {
      res
        .writeHead(401, { "Content-Type": "application/json" })
        .end('{"detail":"Pair this browser with your local engine first."}');
      return;
    }
    if (
      !/^\/(api|media)\//.test(req.url || "") ||
      !["GET", "HEAD", "POST", "PUT", "DELETE"].includes(req.method)
    ) {
      res.writeHead(404).end();
      return;
    }
    // Validate the website before forwarding. The engine then receives a local request.
    const headers = { host: backend.host, origin: backend.origin };
    for (const name of [
      "content-type",
      "content-length",
      "accept",
      "range",
      "if-range",
      "if-none-match",
    ]) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    const proxy = http.request(
      {
        hostname: backend.hostname,
        port: backend.port,
        method: req.method,
        path: req.url,
        headers,
      },
      (upstream) => {
        for (const [name, value] of Object.entries(upstream.headers)) {
          if (
            value !== undefined &&
            ![
              "connection",
              "transfer-encoding",
              "set-cookie",
              "access-control-allow-origin",
              "vary",
            ].includes(name)
          )
            res.setHeader(name, value);
        }
        res.writeHead(upstream.statusCode || 502);
        upstream.pipe(res);
        res.on("close", () => upstream.destroy());
      },
    );
    proxy.on("error", () => {
      if (!res.headersSent)
        res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        '{"detail":"Start the PeakCut video engine on this computer, then try again."}',
      );
    });
    req.on("aborted", () => proxy.destroy());
    req.pipe(proxy);
  });
  server.requestTimeout = 0;
  return server;
}
