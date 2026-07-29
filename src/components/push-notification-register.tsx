"use client";

import * as React from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { registerPushDeviceToken } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";

const pushNotificationsEnabled =
  process.env.NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === "true" &&
  process.env.NEXT_PUBLIC_ANDROID_FIREBASE_CONFIGURED === "true";

function pushDeepLink(data: Record<string, unknown> | undefined) {
  const candidate = data?.deep_link;
  return typeof candidate === "string" && /^\/(dashboard|partner|leads|tasks)(?:\/|$)/.test(candidate) ? candidate : "/partner";
}

export function PushNotificationRegister() {
  React.useEffect(() => {
    if (!pushNotificationsEnabled || !supabase || !Capacitor.isNativePlatform()) return;
    const client = supabase;

    let active = true;
    let removeListeners: Array<() => Promise<void>> = [];

    async function registerForPushNotifications() {
      const { data: { user } } = await client.auth.getUser();
      if (!user || !active) return;

      const { PushNotifications } = await import("@capacitor/push-notifications");
      const permission = await PushNotifications.checkPermissions();
      const result = permission.receive === "prompt" ? await PushNotifications.requestPermissions() : permission;
      if (result.receive !== "granted" || !active) return;
      await PushNotifications.register();
    }

    async function setup() {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await PushNotifications.createChannel({
        id: "crm_activities",
        name: "Atividades do CRM",
        description: "Briefings, visitas e retornos de parceiros.",
        importance: 5,
        visibility: 1,
        sound: "default",
        vibration: true,
      });

      const registration = await PushNotifications.addListener("registration", (token) => {
        void registerPushDeviceToken(token.value).catch(() => {
          if (active) toast.error("Nao foi possivel ativar as notificacoes neste aparelho.");
        });
      });
      const registrationError = await PushNotifications.addListener("registrationError", () => {
        if (active) toast.error("Nao foi possivel registrar este aparelho para notificacoes.");
      });
      const received = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
        if (active) toast.info(notification.title || "Nova atividade no CRM", { description: notification.body });
      });
      const action = await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
        const destination = pushDeepLink(event.notification.data);
        window.location.assign(destination);
      });
      removeListeners = [registration.remove, registrationError.remove, received.remove, action.remove];

      await registerForPushNotifications();
    }

    void setup().catch(() => {
      if (active) toast.error("Nao foi possivel preparar as notificacoes do CRM.");
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void registerForPushNotifications().catch(() => {
          if (active) toast.error("Nao foi possivel ativar as notificacoes neste aparelho.");
        });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      void Promise.all(removeListeners.map((remove) => remove()));
    };
  }, []);

  return null;
}
