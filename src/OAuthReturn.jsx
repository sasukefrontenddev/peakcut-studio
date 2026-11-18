import { useEffect, useRef, useState } from "react";
import { send, getEngineToken } from "./api";
export default function OAuthReturn() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const platform = window.location.pathname.split("/")[2];
  const [message, setMessage] = useState(
    "Finishing your account connection on this computer…",
  );
  const [failed, setFailed] = useState(false),
    started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    const finish = async () => {
      if (!["instagram", "tiktok", "youtube", "facebook"].includes(platform))
        throw new Error("Unknown social platform.");
      const state = params.get("state"),
        expected = sessionStorage.getItem("peakcut-social-" + platform);
      if (!state || state !== expected)
        throw new Error(
          "This sign-in was not started in this tab. Return to Connected accounts and try again.",
        );
      sessionStorage.removeItem("peakcut-social-" + platform);
      if (params.get("error"))
        throw new Error(
          "The platform did not authorize this connection. Return to Connected accounts and try again.",
        );
      if (!getEngineToken() && import.meta.env.PROD)
        throw new Error(
          "Use the same browser that is paired with your PeakCut engine.",
        );
      const result = await send(`/social/${platform}/finish`, {
        code: params.get("code") || "",
        state,
      });
      setMessage(
        `${result.name || platform} is connected. You can now choose this account when publishing a clip.`,
      );
    };
    finish().catch((e) => {
      setFailed(true);
      setMessage(e.message);
    });
  }, [params, platform]);
  return (
    <main className="oauth-return">
      <div className="panel feature-stack">
        <span className="pill">PEAKCUT STUDIO · {platform?.toUpperCase()}</span>
        <h1>
          {failed ? "Connection needs attention" : "Your account. Your studio."}
        </h1>
        <p role={failed ? "alert" : "status"}>{message}</p>
        <p>
          Account tokens and app secrets stay on your computer. This page only
          passes the one-time sign-in result to your paired local engine.
        </p>
        <a className="button" href="/?settings=apps">
          Return to Connected accounts
        </a>
      </div>
    </main>
  );
}
