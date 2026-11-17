# PeakCut feature coverage

Compared with upstream `haziqahmedqasmi/PeakCut` main at `b3e403e27444b620a50a4ec1cf44b3afff9e9e45` on 16 November 2026. The inherited implementation originally matched all 50 `studio/` and `web/` source files. `studio/accounts.py` and `studio/server.py` now include the local HTTPS OAuth relay, with a new `studio/social.py` transport helper. The original engine, routes, signed-in workspace, and admin pages are retained. The React interface is an additional interface over that engine.

| Upstream function | Where to use it |
| --- | --- |
| YouTube/Twitch/Kick links, file uploads, clip ranges, three caption styles, vertical layouts | New project |
| Transcription and AI clip selection | Engine pipeline; configured for local Ollama on this computer |
| AI score and reason for each highlight | Finished clip → AI highlight rating, out of 100 |
| Clip trimming, title, hook, description, style, layout, rerendering, download, deletion | Open a finished clip |
| Platform app registration details and private credential storage | Settings → Connected accounts → Set up |
| Account OAuth sign-in and disconnection | Settings → Connected accounts |
| Immediate and spaced publishing | Finished clip → Publish clip |
| Posting state, errors, retries, cancellation, global pause/resume | Publishing |
| Auto-post account selection, minimum score, spacing, daily cap, visibility, footer | Creators → Clipping & auto-post settings |
| Creator channels, clip settings, live thresholds, watch mode, trigger words, activity log | Creators → Clipping & auto-post settings |
| Start/stop recordings and manual last-30-second clips | Live streams |
| Live loudness/chat/transcript analysis and rolling buffer | Original engine; controls in creator settings |
| Analytics and post views | Analytics and Publishing |
| AI usage history and Discord/Telegram alerts | Settings → AI activity & alerts |
| Bulk clip ZIP downloads, bulk deletion, extended live workspace, detailed creator analytics | Full workspace |
| Storage folder opening/migration, notifications, feedback, detailed profile/account controls | Full workspace → Settings |
| Optional sign-in, email verification/reset, Google sign-in, admin management | Original workspace and admin routes, available when configured |
| Model provider selection | Intentionally kept out of the new UI at the owner’s request; local AI is used without paid API credits |

## What is not activated yet

No social developer apps or user social accounts are configured. Real account authorization and posting have **not** been tested. The forms and publishing actions use the original working engine endpoints. The upstream 38 social connection checks pass with mocked provider responses, covering OAuth, signed clip links, Instagram publishing, TikTok publishing/chunking/private review restrictions, and token refresh.

YouTube requires a Google Cloud OAuth client and YouTube Data API access. Instagram requires an eligible professional account and Meta app permissions. TikTok requires Login Kit, Direct Post permissions, and an audit for public posting. Platform restrictions and approval rules remain in force.

The engine remains loopback-only. The Vercel frontend now serves stable HTTPS OAuth return pages and forwards one-time results through the paired browser. Instagram uses a restricted signed-media gateway with a free Cloudflare Quick Tunnel when the official client is configured. TikTok uploads directly. App credentials, tokens, dashboard routes, and private APIs are not exposed through the tunnel. Platform app setup remains required.

## Verification

- Production build and connector security test pass.
- Four React regression checks cover AI/fallback rating provenance (including zero and missing scores), escaped transcript text, queue actions, creator automation fields, and connection prerequisites.
- A real local AI test clip was rated 90/100 and successfully remade through the React editor; the updated title, rendered file, rating, and version 2 were confirmed from the engine.
- Desktop and mobile account setup screens and clip controls were checked in the browser.
