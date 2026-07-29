import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getFirebasePushConfig, isInvalidFirebaseToken, sendFirebasePush } from "@/lib/push/fcm";
import { hasValidPushWebhookSecret } from "@/lib/push/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  type: z.literal("INSERT"),
  table: z.literal("partner_notifications"),
  record: z.object({ id: z.string().uuid() }),
});

type Delivery = {
  id: string;
  user_id: string;
  status: "pending" | "sending" | "sent" | "failed" | "skipped";
  attempt_count: number;
  deep_link: string;
};

type Notification = {
  id: string;
  lead_id: string | null;
  title: string;
  body: string | null;
};

type DeviceToken = { id: string; token: string };

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function safeDeepLink(value: string) {
  return /^\/(partner|leads)(?:\/|$)/.test(value) ? value : "/partner";
}

export async function POST(request: Request) {
  if (!hasValidPushWebhookSecret(request.headers.get("x-push-webhook-secret"))) {
    return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });
  }

  const event = eventSchema.safeParse(await request.json().catch(() => null));
  if (!event.success) {
    return NextResponse.json({ error: "Evento de notificacao invalido." }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Entrega de notificacoes nao configurada no servidor." }, { status: 503 });
  }

  const { data: deliveryData, error: deliveryError } = await admin
    .from("push_notification_deliveries")
    .select("id, user_id, status, attempt_count, deep_link")
    .eq("notification_id", event.data.record.id)
    .maybeSingle();
  const delivery = deliveryData as Delivery | null;

  if (deliveryError || !delivery) {
    return NextResponse.json({ error: "Fila de notificacao nao encontrada." }, { status: 404 });
  }
  if (delivery.status !== "pending") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: claimedData, error: claimError } = await admin
    .from("push_notification_deliveries")
    .update({ status: "sending", attempt_count: delivery.attempt_count + 1, last_error: null })
    .eq("id", delivery.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (claimError) {
    return NextResponse.json({ error: "Nao foi possivel reservar a entrega." }, { status: 500 });
  }
  if (!claimedData) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!getFirebasePushConfig()) {
    await admin.from("push_notification_deliveries").update({ status: "failed", last_error: "Firebase Push nao configurado." }).eq("id", delivery.id);
    return NextResponse.json({ error: "Firebase Push nao configurado no servidor." }, { status: 503 });
  }

  const [{ data: notificationData, error: notificationError }, { data: deviceData, error: deviceError }] = await Promise.all([
    admin.from("partner_notifications").select("id, lead_id, title, body").eq("id", event.data.record.id).maybeSingle(),
    admin.from("push_device_tokens").select("id, token").eq("user_id", delivery.user_id).is("revoked_at", null),
  ]);
  const notification = notificationData as Notification | null;
  const devices = (deviceData ?? []) as DeviceToken[];

  if (notificationError || !notification || deviceError) {
    await admin.from("push_notification_deliveries").update({ status: "failed", last_error: "Nao foi possivel carregar os dados da entrega." }).eq("id", delivery.id);
    return NextResponse.json({ error: "Nao foi possivel preparar a notificacao." }, { status: 500 });
  }
  if (devices.length === 0) {
    await admin.from("push_notification_deliveries").update({ status: "skipped", last_error: "Nenhum aparelho ativo registrado." }).eq("id", delivery.id);
    return NextResponse.json({ ok: true, skipped: true, reason: "no-active-device" });
  }

  const results = await Promise.allSettled(devices.map((device) => sendFirebasePush({
    token: device.token,
    title: notification.title,
    body: notification.body,
    notificationId: notification.id,
    leadId: notification.lead_id,
    deepLink: safeDeepLink(delivery.deep_link),
  })));

  const invalidDeviceIds = results.flatMap((result, index) => result.status === "rejected" && isInvalidFirebaseToken(result.reason) ? [devices[index].id] : []);
  if (invalidDeviceIds.length > 0) {
    await admin.from("push_device_tokens").update({ revoked_at: new Date().toISOString() }).in("id", invalidDeviceIds);
  }

  const delivered = results.some((result) => result.status === "fulfilled");
  await admin.from("push_notification_deliveries").update({
    status: delivered ? "sent" : "failed",
    sent_at: delivered ? new Date().toISOString() : null,
    last_error: delivered ? null : "Firebase rejeitou a entrega.",
  }).eq("id", delivery.id);

  if (!delivered) return NextResponse.json({ error: "Firebase nao aceitou a entrega." }, { status: 502 });
  return NextResponse.json({ ok: true, delivered: results.filter((result) => result.status === "fulfilled").length });
}
