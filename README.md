# PeakCut Studio

A redesigned PeakCut workspace built with React, React Bits, Motion UI, Motion for React, and Vite. Includes the original FastAPI video engine, creator workspaces, live stream controls, chunked video uploads, caption presets, real activity metrics, account sign-in, and AI configuration.

## Local use

Install Node.js 22.12 or later, Python 3.10 or later, and FFmpeg with FFprobe.

```sh
npm ci
python -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cd backend
.venv/bin/python -m studio.server
```

In another terminal, from the repository root:

```sh
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies API requests to the local video engine on port 8765. The engine downloads the speech model on first start. An AI key is optional; without a key, PeakCut selects clips by loudness.

## Hosting

Deploy the frontend to Vercel with the Vite preset, build command `npm run build`, and output directory `dist`.

Run the engine as a persistent Docker service on Railway using `backend/` as the service root. Use `backend/Dockerfile`, mount a persistent volume at `/data`, and configure:

```text
PEAKCUT_ACCOUNTS=1
PEAKCUT_DATA=/data
PEAKCUT_HOST=0.0.0.0
PEAKCUT_PORT=8765
PEAKCUT_TRUST_PROXY=1
PEAKCUT_PUBLIC_URL=https://YOUR-VERCEL-PRODUCTION-DOMAIN
PEAKCUT_ASR_COPIES=1
PEAKCUT_ASR_THREADS=2
PEAKCUT_JOB_WORKERS=1
PEAKCUT_UPDATE_CHECK=0
```

The Railway Dockerfile stores the speech model in the image rather than consuming the video volume. Use enough persistent disk for your videos and clips, and a server with enough RAM for the 0.6B speech model. Production signup is protected by the engine's existing session and request-origin checks. AI settings require an admin account. Grant an existing account admin access using the documented `python -m studio.admin grant <email>` command on the server.

Once the secured backend is running, replace the temporary `/api` rewrite in `vercel.json` with the backend's HTTPS address. Forward `/api/:path*`, `/media/:path*`, `/oauth/:path*`, and `/auth/:path*` to the same paths on that backend. Keep authentication cookies on the Vercel origin using same-origin rewrites. No API keys belong in the frontend or the public repository.

Until that connection is active, the deployed frontend clearly shows that its video engine is offline and rejects project submission. It does not simulate successful processing or display invented clips or analytics.

## Build

```sh
npm run build
```

## Credits

See [ATTRIBUTION.md](ATTRIBUTION.md). The PeakCut engine's original MIT license and third-party font licenses are preserved.
