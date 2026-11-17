# Instagram and TikTok without paid hosting

The local engine can use the existing Vercel frontend as its stable HTTPS OAuth return address. The paired browser forwards the one-time authorization result to the local engine; state is checked both in the browser session and on the engine. Secrets and account tokens are never returned to the frontend.

Register these exact callback URLs in the platform developer apps:

- `https://peakcut-studio-chi.vercel.app/oauth/instagram/callback`
- `https://peakcut-studio-chi.vercel.app/oauth/tiktok/callback`

TikTok uploads directly from the PC. Instagram needs a clip URL it can fetch: the launcher starts the official `cloudflared` client, pointing at a dedicated loopback media gateway, when `cloudflared` is configured in `.engine-local.json`. Only `GET`/`HEAD` requests for `/pub/<HMAC-signed-token>.mp4` and a minimal health check are permitted. Dashboard, private API, setup, regular media, and OAuth routes are not forwarded. The backend validates signature and expiry before returning a file.

The free tunnel hostname can change when the engine restarts. It is used only for expiring clip downloads; platform OAuth callback addresses stay stable. The engine advertises the tunnel only while its local state heartbeat is fresh. Quick Tunnels require no paid plan, but have no uptime guarantee. Keep the engine awake and running while publishing.

The official macOS ARM64 Cloudflare client used on this computer was downloaded from `cloudflare/cloudflared` release `2026.11.0` and verified against the release’s SHA-256 digest. Binaries and machine configuration are not committed.

## What still needs your setup

You must register the Meta/TikTok developer apps, supply their credentials in Connected accounts, use an eligible Instagram professional account, and complete the required platform permissions/review. The transport does not bypass review or make an unaudited TikTok app able to post publicly. No paid AI API or paid hosting service is added.

## Verification

- Gateway tests reject private API/dashboard/setup/OAuth paths, arbitrary files, malformed tokens, and write requests.
- Browser-return API tests verify stable HTTPS addresses, CSRF/origin checks, one-time user-bound state, token privacy, and stale/untrusted media-host rejection.
- A separate QA engine and a real temporary HTTPS tunnel served the generated demo Reel through a valid signed link. Downloaded bytes matched the original video. Private routes and invalid signatures returned 404.
- Frontend regression tests, connector tests, and the production build pass.
- The upstream suite was run before and after backend changes with FFmpeg on the test path. Both runs had the same four pre-existing failures: one macOS CPU-load fixture and three embedded-backend Git-version fixtures. No new failures appeared.

References: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/), [TikTok web sign-in](https://developers.tiktok.com/doc/login-kit-web/), and [Meta content publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing).
# New Instagram apps: Unified Login

Meta now requires Unified Login for newly created Instagram apps. Create a business-owned Meta app, enable `instagram_basic` and `instagram_content_publish`, and create a Facebook Login for Business configuration with the Instagram account asset. Use a 60-day system-user token configuration if ongoing publishing is needed. Register the exact Instagram callback shown in PeakCut.

Save the Meta app ID, Meta app secret, and the configuration ID in PeakCut's Instagram setup. A configuration ID selects Unified Login; leave it empty only for an older Instagram Login app. Secrets and access tokens remain on the local engine. Unified Login uses `graph.facebook.com`; existing Instagram Login accounts continue using `graph.instagram.com`. Reconnect when a 60-day authorization expires.

The Instagram profile must be a professional account and shared during authorization. Development access is limited to eligible app roles; broader use still requires Meta review. Creating the developer app does not connect a social account or publish any video.
