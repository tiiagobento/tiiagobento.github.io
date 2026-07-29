import { supabase } from "@/lib/supabase/client";

const tokenStorageKey = "nova-forma-crm:push-token";

type StoredPushToken = { userId: string; token: string };

function readStoredToken(): StoredPushToken | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(tokenStorageKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<StoredPushToken>;
    return typeof parsed.userId === "string" && typeof parsed.token === "string" ? { userId: parsed.userId, token: parsed.token } : null;
  } catch {
    return null;
  }
}

export async function registerPushDeviceToken(token: string) {
  if (!supabase || !token) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.rpc("register_push_device_token", {
    registration_token: token,
    registration_platform: "android",
    registration_device_label: "Nova Forma CRM Android",
  });
  if (error) throw error;

  window.localStorage.setItem(tokenStorageKey, JSON.stringify({ userId: user.id, token }));
}

export async function revokeCurrentPushDeviceToken(userId?: string) {
  if (!supabase || typeof window === "undefined") return;
  const stored = readStoredToken();
  if (!stored || (userId && stored.userId !== userId)) return;

  const { error } = await supabase.rpc("revoke_push_device_token", { registration_token: stored.token });
  if (!error) window.localStorage.removeItem(tokenStorageKey);
}
