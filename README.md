# PeakCut Studio

A redesigned PeakCut workspace with React, React Bits, Motion UI, Motion for React, and Vite. The website runs on Vercel. This computer runs the video engine and keeps the files. No paid video server is required.

- Website: https://peakcut-studio-chi.vercel.app
- Repository: https://github.com/sasukefrontenddev/peakcut-studio
- Local connection: http://127.0.0.1:8767
- Full editing workspace: http://127.0.0.1:8765/app

## On this computer

1. Double-click **Start PeakCut Engine.command**, or run `npm run engine`.
2. Open http://127.0.0.1:8767 and click **Connect PeakCut Studio**.
3. If your browser asks, allow the site to connect to your local network.
4. Keep the engine running and this computer awake while making clips.

Pairing creates a private key stored in this browser and on this computer. The key is never put in a URL, published to GitHub, or sent to Vercel's server. The connector listens only on `127.0.0.1`. It checks the website's exact origin, the pairing key, and the local Host header before forwarding API or media requests. Public visitors to the website do not get access to this computer's engine.

Videos, clips, and AI keys stay with the local Python engine. The website fetches previews and downloads directly from this computer. AI analysis sends the transcript to your chosen provider when you supply a key, as in the original PeakCut engine. Without an AI key, clips are selected by loudness.

## Fresh installation

Install Node.js 22.12 or later, Python 3.10 or later, and FFmpeg with FFprobe. Then:

```sh
npm ci
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm run engine
```

The speech model downloads on first start. Local machine paths can be supplied in the ignored `.engine-local.json` file with `python`, `ffmpeg`, `models`, and `data` fields. The optional `PEAKCUT_PYTHON` environment variable selects a Python executable. These settings are private to the computer and are not tracked in Git.

The browser pairing key is in the ignored `.engine-pairing.json` file with owner-only permissions. If it is rotated, reconnect the browser from the local connection page. Keep that file private.

## Development

```sh
npm run dev
```

Open http://127.0.0.1:5173. Vite forwards API calls to the original local engine on port 8765. The full original workspace remains available for the engine's advanced clip editing and publishing controls.

## Build and checks

```sh
npm run build
npm run test:engine
```

The connector tests cover trusted origins, private-network preflight, pairing-key enforcement, non-ASCII invalid keys, command forwarding, unsupported paths, and DNS-rebinding Host rejection.

## Vercel

Use the Vite preset, build command `npm run build`, and output directory `dist`. The deployment serves the frontend only. There are no cloud video-processing routes or video-storage services required by this version. The `backend/Dockerfile` is retained for optional self-hosting on a server.

Pairing is limited to the production hostname listed in `engine/bridge.mjs` and `src/api.js`. Change both when deploying to a different production hostname. Keep an exact allowlist; do not use a wildcard.

## Credits

Built on [PeakCut](https://github.com/haziqahmedqasmi/PeakCut). See [ATTRIBUTION.md](ATTRIBUTION.md) for React Bits, Motion UI, and other credits. The original MIT license and third-party font licenses are preserved.
