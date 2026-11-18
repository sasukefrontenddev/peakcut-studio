import React from "react";
import { createRoot } from "react-dom/client";
import "motion-ui/dist/motion-ui.css";
import App from "./App.jsx";
import OAuthReturn from "./OAuthReturn.jsx";
const isSocialCallback = /^\/oauth\/(instagram|tiktok|youtube|facebook)\/callback$/.test(
  window.location.pathname,
);
import "./styles.css";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isSocialCallback ? <OAuthReturn /> : <App />}
  </React.StrictMode>,
);

import "./dark.css";
