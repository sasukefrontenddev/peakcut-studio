import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBridge } from "./bridge.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localFile = resolve(root, ".engine-local.json");
const local = existsSync(localFile)
  ? JSON.parse(readFileSync(localFile, "utf8"))
  : {};
const pairingFile = resolve(root, ".engine-pairing.json");
const token = existsSync(pairingFile)
  ? JSON.parse(readFileSync(pairingFile, "utf8")).token
  : randomBytes(32).toString("hex");
if (!existsSync(pairingFile))
  writeFileSync(pairingFile, JSON.stringify({ token }), { mode: 0o600 });
const python =
  process.env.PEAKCUT_PYTHON ||
  local.python ||
  (existsSync(resolve(root, "backend/.venv/bin/python"))
    ? resolve(root, "backend/.venv/bin/python")
    : "python3");
let backend;
let closing = false;
const ready = async () => {
  try {
    return (
      await fetch("http://127.0.0.1:8765/healthz", {
        signal: AbortSignal.timeout(1500),
      })
    ).ok;
  } catch {
    return false;
  }
};
if (!(await ready())) {
  console.log("Starting your video engine…");
  backend = spawn(python, ["-m", "studio.server"], {
    cwd: resolve(root, "backend"),
    stdio: "inherit",
    env: {
      ...process.env,
      PEAKCUT_HOST: "127.0.0.1",
      PEAKCUT_PORT: "8765",
      PEAKCUT_PUBLIC_URL: "http://127.0.0.1:8765",
      PEAKCUT_UPDATE_CHECK: "0",
      PEAKCUT_ASR_COPIES: "1",
      PEAKCUT_ASR_THREADS: "2",
      PEAKCUT_JOB_WORKERS: "1",
      ...(local.data ? { PEAKCUT_DATA: local.data } : {}),
      ...(local.models ? { PEAKCUT_MODELS: local.models } : {}),
      ...(local.ffmpeg ? { PEAKCUT_FFMPEG_DIR: local.ffmpeg } : {}),
    },
  });
  backend.on("error", (err) => {
    console.error("The video engine could not start:", err.message);
    process.exit(1);
  });
  backend.on("exit", (code) => {
    if (!closing) {
      console.error("The video engine stopped. Check the message above.");
      process.exit(code || 1);
    }
  });
  let connected = false;
  for (let i = 0; i < 60; i++) {
    if (await ready()) {
      connected = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!connected) {
    backend.kill();
    throw new Error(
      "The video engine did not start. Install the backend requirements and try again.",
    );
  }
}
const server = createBridge({ token });
server.on("error", (err) => {
  console.error(
    err.code === "EADDRINUSE"
      ? "PeakCut Engine is already running on this computer."
      : err.message,
  );
  backend?.kill();
  process.exit(err.code === "EADDRINUSE" ? 0 : 1);
});
server.listen(8767, "127.0.0.1", () => {
  console.log("\nPeakCut Engine is ready.\n");
  console.log("Connect this browser: http://127.0.0.1:8767");
  console.log("Local connection: http://127.0.0.1:8767");
  console.log(
    "\nKeep this window open while making clips. Press Control+C to stop.\n",
  );
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    closing = true;
    server.close();
    backend?.kill("SIGTERM");
    process.exit(0);
  });
