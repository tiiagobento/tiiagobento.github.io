import { afterEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@/lib/push/fcm", () => ({
  getFirebasePushConfig: vi.fn(() => null),
  isInvalidFirebaseToken: vi.fn(() => false),
  sendFirebasePush: vi.fn(),
}));

import { POST } from "@/app/api/internal/push/partner-notification/route";

afterEach(() => {
  delete process.env.PUSH_WEBHOOK_SECRET;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  createClient.mockReset();
});

describe("partner push webhook route", () => {
  it("rejects a missing or incorrect webhook secret before accessing Supabase", async () => {
    process.env.PUSH_WEBHOOK_SECRET = "expected-secret";
    const response = await POST(new Request("https://crm.test/api/internal/push/partner-notification", {
      method: "POST",
      body: JSON.stringify({ type: "INSERT", table: "partner_notifications", record: { id: "5b126f1c-b940-42fa-a1cb-c716d3d43d6c" } }),
    }));

    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("validates the webhook event shape", async () => {
    process.env.PUSH_WEBHOOK_SECRET = "expected-secret";
    const response = await POST(new Request("https://crm.test/api/internal/push/partner-notification", {
      method: "POST",
      headers: { "x-push-webhook-secret": "expected-secret" },
      body: JSON.stringify({ type: "UPDATE", table: "partner_notifications", record: { id: "invalid" } }),
    }));

    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });
});
