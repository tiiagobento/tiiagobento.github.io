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
  const [state, setState] = React.useState<NetworkState>(() => ({
    online: getInitialOnlineState(),
    lastChangedAt: new Date().toISOString(),
  }));

  React.useEffect(() => {
    function update() {
      setState({ online: navigator.onLine, lastChangedAt: new Date().toISOString() });
    }

    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return state;
}
