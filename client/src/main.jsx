import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./lib/auth.jsx";
import { startAutoSync } from "./lib/offlineQueue.js";
import App from "./App.jsx";
import "./index.css";

// Send any reports that were saved while offline.
startAutoSync();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
