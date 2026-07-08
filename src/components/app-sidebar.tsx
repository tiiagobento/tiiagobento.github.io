"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, Columns3, FileUp, LayoutDashboard, MessageSquareText, Settings, Sparkles, UserCheck, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProfileRole } from "@/lib/types";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/leads/ai-import", label: "Preencher com IA", icon: Sparkles },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/tasks", label: "Acoes", icon: ClipboardList },
  { href: "/templates", label: "Templates", icon: MessageSquareText },
  { href: "/partner", label: "Parceiro", icon: UserCheck },
  { href: "/import-export", label: "Importar/Exportar", icon: FileUp },
  { href: "/settings", label: "Configuracoes", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
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

  const visibleItems = role === "partner" ? items.filter((item) => item.href === "/partner") : items;
  const isActive = (href: string) => {
    if (href === "/leads") {
      return pathname === "/leads" || pathname === "/leads/new" || /^\/leads\/[^/]+$/.test(pathname);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <aside className="hidden h-screen w-72 shrink-0 border-r border-white/10 bg-primary text-primary-foreground shadow-2xl shadow-primary/15 lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-accent font-bold text-accent-foreground shadow-lg shadow-accent/20">NF</div>
            <div>
              <p className="text-sm text-white/60">Nova Forma</p>
              <h1 className="text-lg font-semibold">Lead Control</h1>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 p-4">
          {visibleItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/72 transition duration-200 hover:bg-white/10 hover:text-white",
                  active && "bg-white/14 text-white shadow-sm ring-1 ring-white/10",
                )}
              >
                <span className={cn("flex size-8 items-center justify-center rounded-md bg-white/6 transition group-hover:bg-white/10", active && "bg-accent text-accent-foreground")}>
                  <item.icon className="size-4" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4">
          <div className="rounded-xl border border-white/10 bg-white/8 p-4 text-sm text-white/70 shadow-inner shadow-white/5">
            <BarChart3 className="mb-3 size-5 text-accent" />
            Controle leads quentes, visitas e orcamentos sem depender de planilhas soltas.
          </div>
        </div>
      </aside>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/96 px-2 py-2 shadow-2xl shadow-slate-950/15 backdrop-blur lg:hidden">
        {visibleItems.slice(0, 5).map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] text-muted-foreground transition", active && "bg-primary text-primary-foreground shadow-sm")}>
              <item.icon className="size-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
