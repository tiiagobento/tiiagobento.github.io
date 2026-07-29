import { timingSafeEqual } from "node:crypto";

export function hasValidPushWebhookSecret(receivedSecret: string | null) {
  const expectedSecret = process.env.PUSH_WEBHOOK_SECRET?.trim();
  if (!expectedSecret || !receivedSecret) return false;

  const expected = Buffer.from(expectedSecret);
  const received = Buffer.from(receivedSecret);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
