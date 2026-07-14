"use client";

export function clearPrivateRuntimeCache() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
}
