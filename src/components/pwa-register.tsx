"use client";

import * as React from "react";
import { toast } from "sonner";

export function PwaRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV === "development") return;

    let cancelled = false;
    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          if (cancelled) return;
          void registration.update();
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                toast.info("Nova versao offline pronta. Reabra o app para atualizar.");
              }
            });
          });
        })
        .catch(() => {
          toast.error("Nao foi possivel ativar o modo offline neste dispositivo.");
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
