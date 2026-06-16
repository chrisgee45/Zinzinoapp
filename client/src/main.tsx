import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initPwa } from "@/lib/pwa";
import { initTheme } from "@/lib/theme";
import "./index.css";

// Sync stored theme to <html> before React mounts so light-mode users
// don't get a single-frame dark flash on first paint.
initTheme();
initPwa();

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
