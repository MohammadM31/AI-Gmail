// frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/Shared/ErrorBoundary";
import { Toaster } from "sonner";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Toaster position="bottom-right" richColors closeButton />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);