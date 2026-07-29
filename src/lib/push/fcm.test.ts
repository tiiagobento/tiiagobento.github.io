import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFirebaseMessage, getFirebasePushConfig, sendFirebasePush } from "@/lib/push/fcm";

const serviceAccount = {
  project_id: "nova-forma-test",
  client_email: "firebase-admin@example.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\\nnot-a-real-key\\n-----END PRIVATE KEY-----\\n",
};

afterEach(() => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  vi.unstubAllGlobals();
});

describe("Firebase push payload", () => {
  it("keeps a notification payload structured and deep-linked", () => {
    expect(buildFirebaseMessage({
      token: "device-token", title: "Briefing pronto", body: "Abra o briefing", notificationId: "notification-1", leadId: "lead-1", deepLink: "/leads/lead-1/briefing",
    })).toEqual(expect.objectContaining({
      message: expect.objectContaining({
        token: "device-token",
        data: expect.objectContaining({ deep_link: "/leads/lead-1/briefing", lead_id: "lead-1" }),
        android: expect.objectContaining({ priority: "HIGH" }),
      }),
    }));
  });

  it("requires a complete server-side Firebase service account", () => {
    expect(getFirebasePushConfig()).toBeNull();
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(serviceAccount);
    expect(getFirebasePushConfig()?.projectId).toBe("nova-forma-test");
  });

  it("does not call Firebase when server credentials are absent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendFirebasePush({
      token: "device-token", title: "Teste", body: null, notificationId: "notification-1", leadId: null, deepLink: "/partner",
    })).rejects.toThrow("Firebase Push nao configurado");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
