"use client";

import * as React from "react";
import { toast } from "sonner";

export function PwaRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV === "development") return;

    let cancelled = false;
    window.addEventListener("load", () => {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          if (cancelled) return;
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
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
