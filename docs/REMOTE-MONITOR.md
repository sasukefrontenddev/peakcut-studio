# PeakCut Remote on iPhone

PeakCut Remote is a mobile Safari dashboard. It shows clip counts, publishing history, queued/failed uploads, TikTok inbox drafts, active jobs, connected channels and whether creator automation is enabled. It refreshes every 30 seconds while open. Add it to the iPhone Home Screen using Safari → Share → Add to Home Screen.

The service is read-only. Only `GET /status` with a separate 256-bit bearer key can return a deliberately limited snapshot. It never proxies engine API requests, sends social credentials, serves videos, or accepts upload/delete commands. The `/` page is a public login shell with no embedded key or status data. Use HTTPS when accessing it remotely. Keep the private monitor key and any one-tap connection link to yourself.

The computer must remain awake, running the engine and connected to the internet. A free Cloudflare Quick Tunnel supplies the remote HTTPS address after the owner approves that traffic. Cloudflare processes the relay traffic. No paid hosting or AI API is required. **Quick Tunnel addresses can change when the monitor restarts.** The current address/key are saved privately in `.widget-connection.json`; update the phone's bookmark if the address changes. This is not an always-available hosted cloud service.

For an already configured local engine, start `node engine/monitor.mjs`. To include the monitor when starting `npm run engine`, opt in with `"remoteMonitor": true` in the ignored `.engine-local.json`. Do this only after approving remote sharing. The monitor binds to loopback port 8770; only its restricted gateway is tunneled. The existing signed-video gateway remains separate.

Counts describe the engine: clips means currently saved completed clips; published means successful upload history (including posts later deleted on the platform). A connected account does not prove every later upload succeeds. The page shows the timestamp and makes failures or offline/stale data explicit.

## TikTok public-profile fallback

New connections request `video.upload` as well as basic profile and Direct Post permission. If TikTok rejects Direct Post because the client is unaudited, PeakCut can send the file to TikTok's inbox Upload API, provided that permission was granted and the platform allows the app to use it. Reconnect an older TikTok connection to grant inbox-upload permission.

An inbox upload is **not** public posting. The publishing queue shows **Finish in TikTok** and does not increment published counts. Open the TikTok inbox notification, review/edit the draft, and finish publishing there. PeakCut never changes your account visibility. Public unattended Direct Post still needs TikTok review/audit and compliance with its requirements; this code does not bypass that restriction.

If a legacy connection lacks the upload permission, the queue reports a reconnect instruction and stops retrying that setup failure. Once an inbox upload exists, duplicate queue requests are blocked. Slow inbox processing is labeled unconfirmed rather than claimed as a published success.
