import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TextContextMenu } from "./components/TextContextMenu";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { I18nProvider } from "./i18n/I18nContext";

// Suppress the webview menu, including dialogs rendered outside the root.
// Cover handlers still receive the event and open the application's own menu.
document.addEventListener("contextmenu", (event) => event.preventDefault(), { capture: true });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <App />
        <TextContextMenu />
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
