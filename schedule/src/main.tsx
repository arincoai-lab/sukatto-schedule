import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { inject } from "@vercel/analytics";
import App from "./App";
import "./styles.css";

registerSW({ immediate: true });

// Vercel Web Analytics（Cookie不要・プライバシー配慮）。ページビューを自動計測し、
// util/analytics.ts の track() がカスタムイベント（初回登録・Pro CTA等）を送る。
inject();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
