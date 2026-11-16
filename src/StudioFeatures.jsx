import { useEffect, useState } from "react";
import {
  api,
  send,
  localEngineRoute,
  fullStudioUrl,
} from "./api";

const names = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" };
const guides = {
  youtube: {
    url: "https://console.cloud.google.com/apis/credentials",
    steps: [
      "Create a Google Cloud project and enable YouTube Data API v3.",
      "Configure the OAuth consent screen and add your Google account as a test user.",
      "Create a Web application OAuth client. Register the exact redirect address below.",
    ],
    note: "Google controls app verification, upload quotas, and upload visibility.",
  },
  instagram: {
    url: "https://developers.facebook.com/apps/",
    steps: [
      "Create a Meta developer app with Instagram API setup using Instagram Login.",
      "Use a Creator or Business Instagram account and add it as an app tester while developing.",
      "Request instagram_business_basic and instagram_business_content_publish. Register the HTTPS redirect address below.",
    ],
    note: "Instagram needs a public HTTPS engine address for login and for fetching the signed video link. Your current local-only engine cannot provide that link.",
  },
  tiktok: {
    url: "https://developers.tiktok.com/apps/",
    steps: [
      "Register a TikTok developer app. Add Login Kit and Content Posting API with Direct Post.",
      "Request user.info.basic and video.publish. Register the HTTPS redirect address below.",
      "Complete TikTok’s app review and audit for public direct posting.",
    ],
    note: "Unaudited TikTok apps can only publish privately. A public HTTPS callback address is required.",
  },
};
function ErrorText({ error }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
export function SocialConnections({ accounts, connection, refresh, notify }) {
  const [apps, setApps] = useState(null),
    [open, setOpen] = useState(""),
    [id, setId] = useState(""),
    [secret, setSecret] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () => api("/apps").then(setApps);
  useEffect(() => {
    let live = true;
    if (connection === "online")
      api("/apps")
        .then((d) => {
          if (live) setApps(d);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [connection]);
  async function save(e, p) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setApps(
        await send(
          "/apps",
          { platform: p, client_id: id, client_secret: secret },
          "PUT",
        ),
      );
      setId("");
      setSecret("");
      setOpen("");
      await refresh();
      notify(
        "Platform app saved privately on this computer. You can now connect an eligible account.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="feature-stack">
      <div>
        <h2>Connected accounts</h2>
        <p>
          Set up each platform once, then sign in on its own website. PeakCut
          never asks for your social password.
        </p>
      </div>
      <ErrorText error={error} />
      {Object.entries(names).map(([p, name]) => {
        const st = apps?.[p],
          needsHttps = p !== "youtube" && !st?.https;
        return (
          <section className="social-platform" key={p}>
            <div className="social-platform-head">
              <span className={`platform-icon ${p}`}>
                {p === "youtube" ? "▷" : p === "instagram" ? "◎" : "♪"}
              </span>
              <div>
                <h3>{name}</h3>
                <p>
                  {st?.ready
                    ? "Platform app configured"
                    : "One-time platform setup needed"}
                </p>
              </div>
              <button
                className="button outline"
                disabled={connection !== "online"}
                onClick={() => {
                  setOpen(open === p ? "" : p);
                  setId("");
                  setSecret("");
                  setError("");
                }}
              >
                {open === p ? "Close setup" : "Set up"}
              </button>
              {st?.ready && !needsHttps && (
                <a
                  className="button"
                  href={localEngineRoute(`/oauth/${p}/start`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Connect {name} ↗
                </a>
              )}
            </div>
            {accounts
              .filter((a) => a.platform === p)
              .map((a) => (
                <div className="detail-row" key={a.id}>
                  <span>
                    {a.name} {a.detail && <small>{a.detail}</small>}
                  </span>
                  <button
                    className="button outline"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Disconnect ${a.name}? Existing published posts are kept.`,
                        )
                      )
                        return;
                      setBusy(true);
                      try {
                        await api(`/accounts/${a.id}`, { method: "DELETE" });
                        await refresh();
                        notify("Account disconnected");
                      } catch (e) {
                        setError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            {needsHttps && (
              <p className="setup-warning">
                {name} connection is waiting for a public HTTPS engine address.
                Registering the Vercel frontend address alone will not connect
                this local engine.
              </p>
            )}
            {open === p && (
              <form
                onSubmit={(e) => save(e, p)}
                className="feature-stack setup-panel"
              >
                <ol>
                  {guides[p].steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <a href={guides[p].url} target="_blank" rel="noreferrer">
                  Open {name} developer setup ↗
                </a>
                <label>
                  Exact callback address
                  <input
                    readOnly
                    value={st?.redirect || ""}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <p className="muted">{guides[p].note}</p>
                <div className="feature-fields">
                  <label>
                    {st?.id_label || "App ID"}
                    <input
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        st?.ready ? "Saved. Leave blank to keep it." : ""
                      }
                    />
                  </label>
                  <label>
                    {st?.secret_label || "App secret"}
                    <input
                      type="password"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      autoComplete="off"
                      placeholder={
                        st?.ready ? "Saved. Leave blank to keep it." : ""
                      }
                    />
                  </label>
                </div>
                <p className="muted">
                  App credentials are saved on your engine, never in GitHub or
                  the Vercel website. These social publishing credentials are
                  separate from AI; local AI still has no paid API key.
                </p>
                <button className="button" disabled={busy || (!id && !secret)}>
                  Save platform app
                </button>
              </form>
            )}
          </section>
        );
      })}
      <button
        className="button outline"
        disabled={connection !== "online"}
        onClick={() =>
          load()
            .then(refresh)
            .catch((e) => setError(e.message))
        }
      >
        Refresh accounts & setup
      </button>
    </div>
  );
}

export function ClipRating({ clip, job }) {
  const ai = job.ai?.used === true || Boolean(job.ai?.model);
  const score =
    clip.score != null && Number.isFinite(Number(clip.score))
      ? Math.max(0, Math.min(100, Number(clip.score)))
      : null;
  return (
    <div className="clip-rating">
      <div>
        <strong>{ai ? "AI highlight rating" : "Highlight score"}</strong>
        <span className="rating-number">
          {score === null ? "Unrated" : `${score}/100`}
        </span>
      </div>
      {score !== null && (
        <meter
          min="0"
          max="100"
          value={score}
          aria-label={`${ai ? "AI highlight" : "Highlight"} rating ${score} out of 100`}
        />
      )}
      <p>
        {ai
          ? "An estimate of clip appeal, not a prediction of views."
          : "This clip was not selected by AI. Its score comes from the fallback or manual workflow."}
      </p>
      {clip.reason && <p className="rating-reason">{clip.reason}</p>}
      {clip.category && <span className="pill">{clip.category}</span>}
    </div>
  );
}

export function ClipActions({ clip, job, accounts, refresh, notify }) {
  const [mode, setMode] = useState(""),
    [selected, setSelected] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [edit, setEdit] = useState(() => ({
    start: clip.start,
    end: clip.end,
    title: clip.title || "",
    hook: clip.hook || "",
    description: clip.description || "",
    style: clip.style || "bounce",
    layout: clip.layout || "blur",
  }));
  async function act(fn, message) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setMode("");
      await refresh();
      notify(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const posts = Object.entries(clip.posts || {});
  return (
    <div className="feature-stack">
      <div className="feature-actions">
        <button
          className="button outline"
          onClick={() => setMode(mode === "edit" ? "" : "edit")}
        >
          Edit clip
        </button>
        <button
          className="button"
          onClick={() => setMode(mode === "post" ? "" : "post")}
        >
          Publish clip
        </button>
        <button
          className="button outline"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Delete this clip permanently?"))
              act(
                () =>
                  api(`/jobs/${job.id}/clips/${clip.id}`, { method: "DELETE" }),
                "Clip deleted",
              );
          }}
        >
          Delete
        </button>
      </div>
      <ErrorText error={error} />
      {mode === "edit" && (
        <form
          className="feature-stack"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              () =>
                send(`/jobs/${job.id}/clips/${clip.id}/render`, {
                  ...edit,
                  start: Number(edit.start),
                  end: Number(edit.end),
                }),
              "Clip remake queued",
            );
          }}
        >
          <div className="feature-fields">
            {[
              ["start", "Start (seconds)"],
              ["end", "End (seconds)"],
              ["title", "Title"],
              ["hook", "On-screen hook"],
            ].map(([k, label]) => (
              <label key={k}>
                {label}
                <input
                  type={k === "start" || k === "end" ? "number" : "text"}
                  step="0.01"
                  min={k === "start" || k === "end" ? 0 : undefined}
                  value={edit[k]}
                  onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                  required={k === "start" || k === "end"}
                />
              </label>
            ))}
            <label>
              Caption style
              <select
                value={edit.style}
                onChange={(e) => setEdit({ ...edit, style: e.target.value })}
              >
                {["bounce", "hype", "clean"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Layout
              <select
                value={edit.layout}
                onChange={(e) => setEdit({ ...edit, layout: e.target.value })}
              >
                {["blur", "zoom", "crop"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              value={edit.description}
              onChange={(e) =>
                setEdit({ ...edit, description: e.target.value })
              }
            />
          </label>
          <p className="muted">
            Saving rerenders the clip, including captions and hook. Clips can be
            3–180 seconds.
          </p>
          <button className="button" disabled={busy}>
            Save & remake clip
          </button>
        </form>
      )}
      {mode === "post" && (
        <div className="feature-stack">
          <h4>Choose destination accounts</h4>
          {accounts.length ? (
            accounts.map((a) => (
              <label className="feature-check" key={a.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(a.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, a.id]
                        : selected.filter((x) => x !== a.id),
                    )
                  }
                />
                {names[a.platform]} · {a.name}
              </label>
            ))
          ) : (
            <p>Connect an account in Settings → Connected accounts first.</p>
          )}
          <p className="muted">
            Posting uses this clip’s title, description and hashtags.
            Visibility, spacing, and daily limits come from its creator
            settings. Public posting also depends on platform approval.
          </p>
          <div className="feature-actions">
            <button
              className="button"
              disabled={busy || !selected.length}
              onClick={() =>
                act(
                  () =>
                    send("/posts", {
                      job: job.id,
                      clip: clip.id,
                      accounts: selected,
                      now: true,
                    }),
                  "Clip queued for immediate publishing",
                )
              }
            >
              Post now
            </button>
            <button
              className="button outline"
              disabled={busy || !selected.length}
              onClick={() =>
                act(
                  () =>
                    send("/posts", {
                      job: job.id,
                      clip: clip.id,
                      accounts: selected,
                      now: false,
                    }),
                  "Clip added to the spaced posting queue",
                )
              }
            >
              Add to queue
            </button>
          </div>
        </div>
      )}
      {posts.map(([id, p]) => (
        <div className="post-result" key={id}>
          <strong>
            {names[p.platform]} · {p.account_name}
          </strong>
          <span>
            {p.status}
            {p.due_at && p.status === "scheduled"
              ? ` · ${new Date(p.due_at * 1000).toLocaleString()}`
              : ""}
          </span>
          {p.error && <p role="alert">{p.error}</p>}
          {p.url && (
            <a href={p.url} target="_blank" rel="noreferrer">
              View post ↗
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

export function PublishingQueue({ overview, refresh, notify }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function act(fn, message) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      notify(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel feature-stack publishing-panel">
      <div className="section-heading">
        <div>
          <h2>Publishing queue</h2>
          <p>Scheduled posts, results, and failures from your engine.</p>
        </div>
        <button
          className="button outline"
          disabled={busy}
          onClick={() =>
            act(
              () => send("/settings", { paused: !overview?.paused }, "PUT"),
              overview?.paused ? "Publishing resumed" : "Publishing paused",
            )
          }
        >
          {overview?.paused ? "Resume publishing" : "Pause publishing"}
        </button>
      </div>
      <ErrorText error={error} />
      {overview?.posts?.length ? (
        overview.posts.map((p) => (
          <div className="queue-row" key={p.id}>
            <div>
              <strong>{p.title}</strong>
              <p>
                {names[p.platform]} · {p.account_name} · {p.status}
              </p>
              <small>
                {p.status === "scheduled"
                  ? `Scheduled ${new Date(p.due_at * 1000).toLocaleString()}`
                  : p.views != null
                    ? `${p.views} views`
                    : ""}
              </small>
              {p.error && <p className="form-error">{p.error}</p>}
            </div>
            {p.url && (
              <a href={p.url} target="_blank" rel="noreferrer">
                View post ↗
              </a>
            )}
            {p.status === "failed" && (
              <button
                className="button outline"
                disabled={busy}
                onClick={() =>
                  act(
                    () => send(`/posts/${p.id}/retry`, {}),
                    "Post retry queued",
                  )
                }
              >
                Retry
              </button>
            )}
            {p.status === "scheduled" && (
              <button
                className="button outline"
                disabled={busy}
                onClick={() =>
                  act(
                    () => send(`/posts/${p.id}/cancel`, {}),
                    "Scheduled post cancelled",
                  )
                }
              >
                Cancel
              </button>
            )}
          </div>
        ))
      ) : (
        <p>
          No posts yet. Open a finished clip to publish or queue it, or enable
          creator auto-posting.
        </p>
      )}
    </section>
  );
}

const numberFields = [
  ["min_len", "Minimum clip length (seconds)", 5, 120],
  ["max_len", "Maximum clip length (seconds)", 10, 180],
  ["max_clips", "Clips per video", 1, 20],
  ["min_score", "Minimum live AI score", 0, 100],
  ["post_min_score", "Minimum auto-post score", 0, 100],
  ["post_gap_min", "Minutes between posts", 5, 1440],
  ["daily_cap", "Posts per account per day", 1, 50],
  ["buffer_min", "Live buffer (minutes)", 5, 120],
  ["live_per_hour", "Live clips per hour", 1, 60],
  ["ai_every_min", "Live AI interval (minutes)", 1, 30],
  ["auto_jump_pct", "Loudness jump (%)", 20, 300],
  ["must_clip_min", "Force a clip every N minutes (0 = off)", 0, 240],
  ["min_gap_min", "Minimum live clip spacing (minutes)", 0, 60],
  ["rate_per_1k", "Estimated revenue per 1,000 views", 0, 1000],
];
export function CreatorSettings({ creator, accounts, refresh, notify }) {
  const [form, setForm] = useState(() => ({
      ...creator,
      channels: { ...creator.channels },
      accounts: [...(creator.accounts || [])],
    })),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      className="feature-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await send(`/creators/${creator.id}`, form, "PUT");
          await refresh();
          notify("Creator settings saved");
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>Clipping, live recording, and publishing rules for {creator.name}.</p>
      <ErrorText error={error} />
      <div className="feature-fields">
        <label>
          Creator name
          <input
            value={form.name}
            onChange={(e) => field("name", e.target.value)}
            required
          />
        </label>
        {["youtube", "twitch", "kick"].map((p) => (
          <label key={p}>
            {p} channel
            <input
              value={form.channels[p] || ""}
              onChange={(e) =>
                field("channels", { ...form.channels, [p]: e.target.value })
              }
              placeholder="https://…"
            />
          </label>
        ))}
        <label>
          Channel to record
          <input
            value={form.channel || ""}
            onChange={(e) => field("channel", e.target.value)}
          />
        </label>
        <label>
          Caption style
          <select
            value={form.style}
            onChange={(e) => field("style", e.target.value)}
          >
            {["bounce", "hype", "clean"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Video layout
          <select
            value={form.layout}
            onChange={(e) => field("layout", e.target.value)}
          >
            {["blur", "zoom", "crop"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Post visibility
          <select
            value={form.privacy}
            onChange={(e) => field("privacy", e.target.value)}
          >
            {["public", "unlisted", "private"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        {numberFields.map(([k, label, min, max]) => (
          <label key={k}>
            {label}
            <input
              type="number"
              min={min}
              max={max}
              step={k === "rate_per_1k" ? "0.01" : "1"}
              value={form[k] ?? min}
              onChange={(e) => field(k, Number(e.target.value))}
            />
          </label>
        ))}
        <label>
          Live decision mode
          <select
            value={form.decide_mode}
            onChange={(e) => field("decide_mode", e.target.value)}
          >
            <option value="both">Loudness and chat</option>
            <option value="either">Loudness or chat</option>
          </select>
        </label>
        <label>
          Trigger words
          <input
            value={form.trigger_words || ""}
            onChange={(e) => field("trigger_words", e.target.value)}
          />
        </label>
        <label>
          Posting footer
          <input
            value={form.post_footer || ""}
            onChange={(e) => field("post_footer", e.target.value)}
          />
        </label>
      </div>
      {[
        ["auto_watch", "Automatically watch for streams"],
        ["ai_only_on_spike", "Run live AI only on activity spikes"],
        ["autopost", "Automatically publish qualifying finished clips"],
      ].map(([k, label]) => (
        <label className="feature-check" key={k}>
          <input
            type="checkbox"
            checked={Boolean(form[k])}
            onChange={(e) => field(k, e.target.checked)}
          />
          {label}
        </label>
      ))}
      <h3>Auto-post destinations</h3>
      {accounts.length ? (
        accounts.map((a) => (
          <label className="feature-check" key={a.id}>
            <input
              type="checkbox"
              checked={form.accounts.includes(a.id)}
              onChange={(e) =>
                field(
                  "accounts",
                  e.target.checked
                    ? [...form.accounts, a.id]
                    : form.accounts.filter((x) => x !== a.id),
                )
              }
            />
            {names[a.platform]} · {a.name}
          </label>
        ))
      ) : (
        <p>Connect accounts in Settings before enabling auto-posting.</p>
      )}
      <button className="button" disabled={busy}>
        Save creator settings
      </button>
      <details>
        <summary>Creator activity log</summary>
        {(creator.log || []).map((entry, i) => (
          <p key={i}>
            {typeof entry === "string" ? entry : JSON.stringify(entry)}
          </p>
        ))}
      </details>
    </form>
  );
}

export function OriginalWorkspace() {
  return (
    <section className="panel feature-stack">
      <h2>Complete PeakCut workspace</h2>
      <p>
        The original workspace is included with the engine, including bulk
        downloads and deletion, detailed AI usage, alerts, storage migration,
        account management, and administrator tools. Open it on this computer.
      </p>
      <div className="feature-actions">
        <a
          className="button outline"
          href={fullStudioUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open full workspace ↗
        </a>
        <a
          className="button outline"
          href={localEngineRoute("/app/settings")}
          target="_blank"
          rel="noreferrer"
        >
          Advanced settings ↗
        </a>
      </div>
    </section>
  );
}

export function UsageAndAlerts({ connection, notify }) {
  const [usage, setUsage] = useState(null),
    [settings, setSettings] = useState(null),
    [form, setForm] = useState({
      discord_webhook: "",
      telegram_token: "",
      telegram_chat: "",
      digest_hour: 8,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    if (connection === "online")
      Promise.all([api("/usage"), api("/settings")])
        .then(([u, s]) => {
          if (live) {
            setUsage(u);
            setSettings(s);
            setForm((f) => ({
              ...f,
              telegram_chat: s.telegram_chat || "",
              digest_hour: s.digest_hour ?? 8,
            }));
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [connection]);
  async function act(fn, message) {
    setBusy(true);
    setError("");
    try {
      await fn();
      notify(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="feature-stack">
      <h2>AI activity & alerts</h2>
      <ErrorText error={error} />
      <p>
        {usage?.calls_total ?? 0} local AI calls · {usage?.tokens_total ?? 0}{" "}
        tokens processed. These measure computer work, not a credit balance or
        bill.
      </p>
      <details>
        <summary>Recent AI activity</summary>
        {(usage?.recent || []).map((r, i) => (
          <div className="detail-row" key={i}>
            <span>
              {r.purpose} · {r.where}
            </span>
            <span>{r.tokens} tokens</span>
          </div>
        ))}
      </details>
      <form
        className="feature-stack"
        onSubmit={(e) => {
          e.preventDefault();
          act(async () => {
            const body = {
              telegram_chat: form.telegram_chat,
              digest_hour: Number(form.digest_hour),
            };
            if (form.discord_webhook)
              body.discord_webhook = form.discord_webhook;
            if (form.telegram_token) body.telegram_token = form.telegram_token;
            setSettings(await send("/settings", body, "PUT"));
            setForm((f) => ({ ...f, discord_webhook: "", telegram_token: "" }));
          }, "Alert settings saved");
        }}
      >
        <h3>Notifications</h3>
        <p>
          Optional Discord and Telegram delivery, using the original PeakCut
          alert system. Saved secrets are never displayed again.
        </p>
        <label>
          Discord webhook
          <input
            type="password"
            autoComplete="off"
            value={form.discord_webhook}
            placeholder={
              settings?.discord_webhook
                ? "Saved. Leave blank to keep it."
                : "https://discord.com/api/webhooks/…"
            }
            onChange={(e) =>
              setForm({ ...form, discord_webhook: e.target.value })
            }
          />
        </label>
        <label>
          Telegram bot token
          <input
            type="password"
            autoComplete="off"
            value={form.telegram_token}
            onChange={(e) =>
              setForm({ ...form, telegram_token: e.target.value })
            }
          />
        </label>
        <div className="feature-fields">
          <label>
            Telegram chat ID
            <input
              value={form.telegram_chat}
              onChange={(e) =>
                setForm({ ...form, telegram_chat: e.target.value })
              }
            />
          </label>
          <label>
            Daily digest hour (local time)
            <input
              type="number"
              min="0"
              max="23"
              value={form.digest_hour}
              onChange={(e) =>
                setForm({ ...form, digest_hour: e.target.value })
              }
            />
          </label>
        </div>
        <button className="button" disabled={busy || connection !== "online"}>
          Save alert settings
        </button>
      </form>
      <button
        className="button outline"
        disabled={busy || connection !== "online"}
        onClick={() =>
          act(() => send("/alerts/test", {}), "Test notification sent")
        }
      >
        Send test notification
      </button>
    </div>
  );
}
