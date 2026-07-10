"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { getVisibleNavigationItems, useActiveNavigation, useLogout, useNavigationRole } from "@/components/app-navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const role = useNavigationRole();
  const visibleItems = getVisibleNavigationItems(role);
  const isActive = useActiveNavigation();
  const { logout, isLoggingOut, icon: LogoutIcon } = useLogout();

  return (
      <aside className="hidden h-screen w-72 shrink-0 border-r border-white/10 bg-primary text-primary-foreground shadow-2xl shadow-primary/20 lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-accent font-bold text-accent-foreground shadow-lg shadow-accent/25 ring-1 ring-white/15">NF</div>
            <div>
              <p className="text-sm text-white/60">Nova Forma</p>
              <h1 className="text-lg font-semibold">Lead Control</h1>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-3.5">
          {visibleItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/72 transition duration-200 hover:bg-white/10 hover:text-white",
                  active && "bg-white/14 text-white shadow-sm ring-1 ring-white/12",
                )}
              >
                <span className={cn("flex size-8 items-center justify-center rounded-lg bg-white/6 transition group-hover:bg-white/10", active && "bg-accent text-accent-foreground shadow-sm shadow-accent/20")}>
                  <item.icon className="size-4" />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4">
          <div className="rounded-xl border border-white/10 bg-white/8 p-4 text-sm text-white/72 shadow-inner shadow-white/5">
            <BarChart3 className="mb-3 size-5 text-accent" />
            CRM comercial para visitas, orcamentos e follow-ups em steel frame.
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <Button type="button" variant="ghost" className="w-full justify-start text-white/72 hover:bg-white/10 hover:text-white" onClick={logout} disabled={isLoggingOut}>
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/6">
                <LogoutIcon className="size-4" />
              </span>
              {isLoggingOut ? "Saindo..." : "Sair"}
            </Button>
          </div>
        </div>
      </aside>
  );
}
