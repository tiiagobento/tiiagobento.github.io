import "server-only";

import { GoogleAuth } from "google-auth-library";

type FirebaseServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  [key: string]: unknown;
};

export type PushMessageInput = {
  token: string;
  title: string;
  body: string | null;
  notificationId: string;
  leadId: string | null;
  deepLink: string;
};

export class PushConfigurationError extends Error {}

export class FirebasePushError extends Error {
  constructor(public readonly status: number, public readonly responseBody: string) {
    super("Firebase rejeitou a notificacao push.");
  }
}

export function getFirebasePushConfig() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!rawServiceAccount) return null;

  try {
    const serviceAccount = JSON.parse(rawServiceAccount) as FirebaseServiceAccount;
    const projectId = serviceAccount.project_id?.trim();
    if (!projectId || !serviceAccount.client_email || !serviceAccount.private_key) return null;
    return { projectId, serviceAccount };
  } catch {
    return null;
  }
}

export function buildFirebaseMessage(input: PushMessageInput) {
  return {
    message: {
      token: input.token,
      notification: {
        title: input.title,
        body: input.body ?? "Ha uma nova atividade no Nova Forma CRM.",
      },
      data: {
        notification_id: input.notificationId,
        lead_id: input.leadId ?? "",
        deep_link: input.deepLink,
      },
      android: {
        priority: "HIGH",
        notification: {
          channel_id: "crm_activities",
          sound: "default",
        },
      },
    },
  };
}

export async function sendFirebasePush(input: PushMessageInput) {
  const config = getFirebasePushConfig();
  if (!config) throw new PushConfigurationError("Firebase Push nao configurado no servidor.");

  const auth = new GoogleAuth({
    credentials: config.serviceAccount,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  const accessToken = await auth.getAccessToken();
  if (!accessToken) throw new PushConfigurationError("Nao foi possivel autorizar o envio pelo Firebase.");

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildFirebaseMessage(input)),
    cache: "no-store",
  });
  const responseBody = await response.text();
  if (!response.ok) throw new FirebasePushError(response.status, responseBody);
}

export function isInvalidFirebaseToken(error: unknown) {
  return error instanceof FirebasePushError
    && (error.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(error.responseBody));
}
