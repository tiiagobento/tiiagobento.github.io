"use client";

import * as React from "react";

const PRIVATE_ROUTES = ["/dashboard", "/leads", "/pipeline", "/tasks", "/templates", "/settings", "/partner", "/import-export"];

/** Caches the authenticated app shell after a successful online session. */
export function OfflineWarmup() {
  React.useEffect(() => {
    if (!navigator.onLine || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.ready.then((registration) => {
      const target = navigator.serviceWorker.controller ?? registration.active;
      target?.postMessage({ type: "WARM_PRIVATE_ROUTES", urls: PRIVATE_ROUTES });
    });
  }, []);

  return null;
}
