import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

// Gracefully suppress benign Vite HMR WebSocket closed notices in sandboxed preview / dev mode
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (
      event.reason &&
      (String(event.reason).includes("WebSocket") ||
        String(event.reason?.message).includes("WebSocket"))
    ) {
      event.preventDefault();
    }
  });
}

if (typeof window !== "undefined") {
  try {
    const sessionToken = sessionStorage.getItem("pos_token");
    if (!sessionToken) {
      // Fresh app open or closed window: wipe stale tokens to force login screen
      localStorage.removeItem("pos_token");
      localStorage.removeItem("token");
    } else {
      // Active session (e.g. page refresh): ensure localStorage is in sync
      localStorage.setItem("pos_token", sessionToken);
    }
  } catch (e) {}
}

setBaseUrl("");

setAuthTokenGetter(() => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token");
});

const root = document.getElementById("root");
if (root) {
  root.setAttribute("dir", "rtl");
}

createRoot(root!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
