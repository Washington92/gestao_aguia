import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import "./modules.css";
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.error("Não foi possível ativar o modo instalável:", error);
    });
  });
}
