import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RouteAuthorization =
  | { status: "authorized"; userId: string }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

/**
 * Authorizes server-side actions through the same RLS permission function
 * used by the database. Client-side visibility is never the access boundary.
 */
export async function authorizeServerPermission(permissionName: string): Promise<RouteAuthorization> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return { status: "unauthenticated" };

    const { data: allowed, error: permissionError } = await supabase.rpc("has_permission", {
      permission_name: permissionName,
    });

    if (permissionError || !allowed) return { status: "forbidden" };
    return { status: "authorized", userId: user.id };
  } catch {
    return { status: "unauthenticated" };
  }
}
