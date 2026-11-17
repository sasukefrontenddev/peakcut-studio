import http from "node:http";
import { spawn } from "node:child_process";
import { writeFileSync, renameSync } from "node:fs";

// Public traffic can reach only expiring, HMAC-signed video links. Never proxy the engine API.
export function createMediaGateway({
  backendURL = "http://127.0.0.1:8765",
} = {}) {
  const backend = new URL(backendURL);
  if (
    backend.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(backend.hostname)
  )
    throw new Error("The engine must remain local.");
  let active = 0;
  return http.createServer((req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (req.method === "GET" && req.url === "/healthz") {
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end('{"ok":true,"service":"signed-clip-relay"}');
      return;
    }
    if (
      !["GET", "HEAD"].includes(req.method) ||
      !/^\/pub\/[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{24}\.mp4$/.test(
        req.url || "",
      )
    ) {
      res.writeHead(404).end();
      return;
    }
    if (active >= 6) {
      res.writeHead(429).end();
      return;
    }
    active++;
    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        active--;
      }
    };
    const headers = { host: backend.host };
    if (req.headers.range) headers.range = req.headers.range;
    const proxy = http.request(
      {
        hostname: backend.hostname,
        port: backend.port,
        path: req.url,
        method: req.method === "HEAD" ? "GET" : req.method,
        headers,
        timeout: 20000,
      },
      (up) => {
        for (const name of [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
        ])
          if (up.headers[name]) res.setHeader(name, up.headers[name]);
        res.writeHead(up.statusCode || 502);
        if (req.method === "HEAD") {
          res.end();
          up.destroy();
          finish();
          return;
        }
        up.pipe(res);
        up.on("end", finish);
        up.on("error", () => {
          finish();
          res.destroy();
        });
      },
    );
    proxy.on("timeout", () => proxy.destroy());
    proxy.on("error", () => {
      finish();
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    res.on("close", () => {
      finish();
      proxy.destroy();
    });
    proxy.end();
  });
}

export async function startFreeTunnel({
  executable,
  stateFile,
  backendURL,
  port = 8768,
}) {
  const gateway = createMediaGateway({ backendURL });
  await new Promise((resolve, reject) => {
    gateway.once("error", reject);
    gateway.listen(port, "127.0.0.1", resolve);
  });
  const persist = (url = "", error = "") => {
    const data = { url, expires: url ? Date.now() / 1000 + 90 : 0, error };
    writeFileSync(stateFile + ".tmp", JSON.stringify(data), { mode: 0o600 });
    renameSync(stateFile + ".tmp", stateFile);
  };
  persist("", "Starting the free Instagram clip link…");
  const child = spawn(
    executable,
    [
      "tunnel",
      "--no-autoupdate",
      "--url",
      `http://127.0.0.1:${port}`,
      "--protocol",
      "http2",
      "--metrics",
      "127.0.0.1:0",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let url = "",
    timer,
    stopped = false;
  const stop = () => {
    stopped = true;
    clearInterval(timer);
    persist(
      "",
      "The free clip link is stopped. Start PeakCut Engine to reconnect.",
    );
    child.kill();
    gateway.close();
    gateway.closeAllConnections();
  };
  const read = (data) => {
    const found = String(data).match(
      /https:\/\/[a-z0-9-]+\.trycloudflare\.com/,
    );
    if (found && !url && !stopped) {
      url = found[0];
      persist(url);
      timer = setInterval(() => persist(url), 30000);
      console.log(
        "Free Instagram clip relay is ready. Only signed clips can be fetched.",
      );
    }
  };
  child.stdout.on("data", read);
  child.stderr.on("data", read);
  child.on("error", () => {
    persist("", "The free tunnel client could not start.");
    gateway.close();
  });
  child.on("exit", () => {
    stopped = true;
    clearInterval(timer);
    persist(
      "",
      "The free clip link is offline. Restart PeakCut Engine to reconnect.",
    );
    gateway.close();
  });
  return { stop, gateway, child };
}
