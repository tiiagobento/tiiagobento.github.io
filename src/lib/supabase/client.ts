import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseMissingEnvMessage, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

export { isSupabaseConfigured };

export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(supabaseMissingEnvMessage);
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

export const supabase = isSupabaseConfigured ? createSupabaseBrowserClient() : null;
