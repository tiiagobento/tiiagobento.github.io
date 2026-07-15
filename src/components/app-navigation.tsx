"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Columns3, FileUp, LayoutDashboard, LogOut, MessageSquareText, Plus, Settings, Sparkles, UserCheck, Users } from "lucide-react";
import { clearOfflineDbForUser } from "@/lib/offline/db";
import { clearPrivateRuntimeCache } from "@/lib/offline/pwa-cache";
import { supabase } from "@/lib/supabase/client";
import type { ProfileRole } from "@/lib/types";

export const navigationItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/leads/new", label: "Novo lead", icon: Plus },
  { href: "/leads/ai-import", label: "Importar com IA", icon: Sparkles },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/tasks", label: "Tarefas", icon: ClipboardList },
  { href: "/templates", label: "Templates", icon: MessageSquareText },
  { href: "/partner", label: "Parceiro/Bruno", icon: UserCheck },
  { href: "/import-export", label: "Importar/Exportar", icon: FileUp },
  { href: "/settings", label: "Configuracoes", icon: Settings },
];

export function getVisibleNavigationItems(role: ProfileRole | null) {
  if (role === "partner") {
    return navigationItems.filter((item) => item.href === "/partner");
  }
  return navigationItems;
}

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/leads") {
    return pathname === "/leads" || /^\/leads\/[^/]+$/.test(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function useNavigationRole() {
  const [role, setRole] = React.useState<ProfileRole | null>(null);

  React.useEffect(() => {
    let mounted = true;
    async function loadRole() {
      if (!supabase) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
      if (mounted) setRole((data?.role as ProfileRole | undefined) ?? null);
    }
    void loadRole();
    return () => {
      mounted = false;
    };
  }, []);

  return role;
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
