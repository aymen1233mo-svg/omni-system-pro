import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

// Intercept benign dev-mode WebSocket HMR disconnection events in sandbox iframe
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason?.message || event.reason || '');
    if (reasonStr.includes('WebSocket') || reasonStr.includes('websocket')) {
      event.preventDefault();
    }
  });
}

if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("pos_token");
    localStorage.removeItem("token");
  } catch (e) {}
}

setBaseUrl("");
setAuthTokenGetter(() => {
  return sessionStorage.getItem("pos_token");
});

const root = document.getElementById("root");
if (root) {
  root.setAttribute("dir", "rtl");
}

createRoot(root!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
