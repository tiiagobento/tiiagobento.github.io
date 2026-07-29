import { afterEach, describe, expect, it } from "vitest";
import { hasValidPushWebhookSecret } from "@/lib/push/webhook";

afterEach(() => {
  delete process.env.PUSH_WEBHOOK_SECRET;
});

describe("push webhook authorization", () => {
  it("accepts only the configured secret", () => {
    process.env.PUSH_WEBHOOK_SECRET = "local-test-secret";
    expect(hasValidPushWebhookSecret("local-test-secret")).toBe(true);
    expect(hasValidPushWebhookSecret("other-secret")).toBe(false);
    expect(hasValidPushWebhookSecret(null)).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    expect(hasValidPushWebhookSecret("any-value")).toBe(false);
  });
});
