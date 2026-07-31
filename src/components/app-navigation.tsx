"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes, ClipboardList, Columns3, FileText, FileUp, LayoutDashboard, LogOut, MessageSquareText, Plus, Settings, Sparkles, UserCheck, Users } from "lucide-react";
import { clearOfflineDbForUser } from "@/lib/offline/db";
import { clearPrivateRuntimeCache } from "@/lib/offline/pwa-cache";
import { revokeCurrentPushDeviceToken } from "@/lib/push/client";
import { isPrimaryAdminEmail } from "@/lib/admin-identity";
import { supabase } from "@/lib/supabase/client";
import type { ProfileRole } from "@/lib/types";

export type NavigationItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permissionAny?: readonly string[];
};

export const navigationItems: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users, permissionAny: ["leads.view_own", "leads.view_assigned", "leads.view_all"] },
  { href: "/leads/new", label: "Novo lead", icon: Plus, permissionAny: ["leads.create"] },
  { href: "/leads/ai-import", label: "Importar com IA", icon: Sparkles, permissionAny: ["ai.import"] },
  { href: "/pipeline", label: "Pipeline", icon: Columns3, permissionAny: ["leads.view_own", "leads.view_assigned", "leads.view_all"] },
  { href: "/tasks", label: "Tarefas", icon: ClipboardList, permissionAny: ["tasks.view_own", "tasks.view_assigned", "tasks.view_all"] },
  { href: "/templates", label: "Templates", icon: MessageSquareText, permissionAny: ["templates.view_own", "templates.view_all", "templates.manage"] },
  { href: "/estimates", label: "Orcamentos", icon: FileText, permissionAny: ["estimates.view_own", "estimates.view_assigned", "estimates.manage_all"] },
  { href: "/estimates/catalog", label: "Catalogo Steel Frame", icon: Boxes, permissionAny: ["estimates.catalog.view", "estimates.catalog.manage", "estimates.manage_all"] },
  { href: "/partner", label: "Parceiros", icon: UserCheck, permissionAny: ["leads.view_assigned", "briefings.view_assigned", "visits.submit_feedback"] },
  { href: "/import-export", label: "Importar/Exportar", icon: FileUp, permissionAny: ["data.import", "data.export"] },
  { href: "/settings", label: "Configuracoes", icon: Settings },
  { href: "/settings/users", label: "Usuarios e acessos", icon: Users, permissionAny: ["users.manage", "permissions.manage", "audit.view"] },
];

// These permissions drive both menu visibility and the header shortcuts. Keeping
// them in one lookup prevents a partner from seeing an action the administrator
// did not grant.
const allNavigationPermissions = [...new Set([
  ...navigationItems.flatMap((item) => item.permissionAny ?? []),
  "ai.daily_plan",
  "estimates.approve",
  "estimates.proposals.generate",
])];

export function getVisibleNavigationItems(role: ProfileRole | null, permissions?: readonly string[] | null) {
  if (role === "partner" && permissions === undefined) {
    return navigationItems.filter((item) => item.href === "/partner");
  }

  const granted = new Set(permissions ?? []);
  const hasPermission = (item: NavigationItem) => role === "admin" || granted.has("*") || !item.permissionAny || item.permissionAny.some((key) => granted.has(key));

  if (role === "partner") {
    return navigationItems.filter((item) => item.href === "/partner" || (Boolean(item.permissionAny) && hasPermission(item)));
  }

  return navigationItems.filter(hasPermission);
}

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/leads") {
    return pathname === "/leads" || /^\/leads\/[^/]+$/.test(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function useNavigationRole() {
  return useNavigationAccess().role;
}

export function useNavigationAccess() {
  const [state, setState] = React.useState<{ role: ProfileRole | null; permissions: string[]; loading: boolean }>({ role: null, permissions: [], loading: true });

  React.useEffect(() => {
    let mounted = true;
    async function loadRole() {
      try {
        const client = supabase;
        if (!client) {
          if (mounted) setState({ role: null, permissions: [], loading: false });
          return;
        }
        const { data: userData } = await client.auth.getUser();
        if (!userData.user) {
          if (mounted) setState({ role: null, permissions: [], loading: false });
          return;
        }
        if (isPrimaryAdminEmail(userData.user.email)) {
          if (mounted) setState({ role: "admin", permissions: ["*"], loading: false });
          return;
        }
        const { data } = await client.from("profiles").select("role, active").eq("id", userData.user.id).maybeSingle();
        const role = data?.active === false ? null : (data?.role as ProfileRole | undefined) ?? null;
        if (!role) {
          if (mounted) setState({ role: null, permissions: [], loading: false });
          return;
        }
        if (role === "admin") {
          if (mounted) setState({ role, permissions: ["*"], loading: false });
          return;
        }

        const results = await Promise.all(allNavigationPermissions.map(async (permission) => {
          const { data: allowed } = await client.rpc("has_permission", { permission_name: permission });
          return allowed ? permission : null;
        }));
        if (mounted) setState({ role, permissions: results.filter((permission): permission is string => Boolean(permission)), loading: false });
      } catch {
        if (mounted) setState({ role: null, permissions: [], loading: false });
      }
    }
    void loadRole();
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

export function useLogout() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  async function logout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      if (!supabase) throw new Error("Supabase nao configurado.");
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id) {
        await revokeCurrentPushDeviceToken(data.session.user.id);
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      if (data.session?.user.id) {
        await clearOfflineDbForUser(data.session.user.id);
      }
      clearPrivateRuntimeCache();
      toast.success("Voce saiu da conta.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel sair da conta.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return { logout, isLoggingOut, icon: LogOut };
}

export function useActiveNavigation() {
  const pathname = usePathname();
  return React.useCallback((href: string) => isNavigationItemActive(pathname, href), [pathname]);
}
