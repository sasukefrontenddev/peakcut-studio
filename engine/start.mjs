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
let ollama;
let closing = false;
if (local.ollama) {
  const aiReady = async () => {
    try { return (await fetch('http://127.0.0.1:11434/api/version', {signal: AbortSignal.timeout(1500)})).ok; }
    catch { return false; }
  };
  if (!await aiReady()) {
    console.log('Starting your local AI. No cloud credits are used.');
    ollama = spawn(local.ollama, ['serve'], {
      stdio: 'ignore',
      env: {...process.env, OLLAMA_HOST:'127.0.0.1:11434', OLLAMA_NO_CLOUD:'1', LLAMA_ARG_DEVICE:'none', OLLAMA_MODELS:local.ollamaModels || resolve(root,'backend/data/ollama-models'), OLLAMA_CONTEXT_LENGTH:'8192', OLLAMA_NUM_PARALLEL:'1', OLLAMA_MAX_LOADED_MODELS:'1', OLLAMA_KEEP_ALIVE:'5m'},
    });
    ollama.on('error', err => {console.error('Local AI could not start:',err.message);process.exit(1);});
    let available = false;
    for(let i=0;i<60;i++){if(await aiReady()){available=true;break;}await new Promise(r=>setTimeout(r,500));}
    if(!available){ollama.kill();throw new Error('Local AI did not start. Check your Ollama installation.');}
  }
}
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
if (local.ollama) {
  const saved = await fetch('http://127.0.0.1:8765/api/ai', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'ollama',models:local.aiModel || 'peakcut-local:latest',base_url:'http://127.0.0.1:11434/v1',key:'',remove_key:true})});
  if (!saved.ok) console.log('The engine is running. Local AI settings need to be checked in Settings.');
  else console.log('Local AI configured. No API key or cloud credits are needed.');
}
const server = createBridge({ token });
server.on("error", (err) => {
  console.error(
    err.code === "EADDRINUSE"
      ? "PeakCut Engine is already running on this computer."
      : err.message,
  );
  backend?.kill();
  ollama?.kill();
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
    ollama?.kill("SIGTERM");
    process.exit(0);
  });
