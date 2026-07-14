"use client";

import * as React from "react";

export type NetworkState = {
  online: boolean;
  lastChangedAt: string;
};

export function getInitialOnlineState() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function useNetworkStatus() {
  const [state, setState] = React.useState<NetworkState>({
    online: true,
    lastChangedAt: "",
  });

  React.useEffect(() => {
    let cancelled = false;
    let removeNativeListener: (() => Promise<void>) | undefined;

    function update(online = navigator.onLine) {
      setState({ online, lastChangedAt: new Date().toISOString() });
    }

    function updateFromBrowser() {
      update(navigator.onLine);
    }

    update();
    window.addEventListener("online", updateFromBrowser);
    window.addEventListener("offline", updateFromBrowser);

    // Capacitor exposes a more reliable connection signal than navigator.onLine on Android.
    void import("@capacitor/network")
      .then(async ({ Network }) => {
        const status = await Network.getStatus();
        if (!cancelled) update(status.connected);
        const listener = await Network.addListener("networkStatusChange", (next) => update(next.connected));
        removeNativeListener = () => listener.remove();
      })
      .catch(() => {
        // The browser fallback above remains active when the native plugin is unavailable.
      });

    return () => {
      cancelled = true;
      window.removeEventListener("online", updateFromBrowser);
      window.removeEventListener("offline", updateFromBrowser);
      void removeNativeListener?.();
    };
  }, []);

  return state;
}
