"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Columns3,
  FileUp,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Settings,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OfflineStatus } from "@/components/offline-status";
import { isNavigationItemActive, useLogout, useNavigationRole } from "@/components/app-navigation";
import { cn } from "@/lib/utils";

const primaryItems = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/tasks", label: "Tarefas", icon: ClipboardList },
];

const moreItems = [
  { href: "/leads/new", label: "Novo lead", icon: Plus },
  { href: "/templates", label: "Templates", icon: MessageSquareText },
  { href: "/leads/ai-import", label: "Importar com IA", icon: Sparkles },
  { href: "/partner", label: "Parceiro", icon: UserCheck },
  { href: "/import-export", label: "Importar/Exportar", icon: FileUp },
  { href: "/settings", label: "Configuracoes", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const role = useNavigationRole();
  const { logout, isLoggingOut } = useLogout();
  const [open, setOpen] = React.useState(false);
  const partnerOnly = role === "partner";
  const mainItems = partnerOnly ? [{ href: "/partner", label: "Parceiro", icon: UserCheck }] : primaryItems;
  const moreActive = moreItems.some((item) => isNavigationItemActive(pathname, item.href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/94 px-2 pt-2 shadow-[0_-18px_38px_-30px_rgb(15_23_42/0.55)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 pb-[calc(env(safe-area-inset-bottom)+0.45rem)]">
        {mainItems.map((item) => (
          <BottomLink key={item.href} item={item} active={isNavigationItemActive(pathname, item.href)} />
        ))}
        {!partnerOnly && mainItems.length < 4
          ? Array.from({ length: 4 - mainItems.length }).map((_, index) => <span key={index} aria-hidden />)
          : null}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className={cn(
                "mobile-nav-item group flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold text-muted-foreground transition active:scale-[0.98]",
                moreActive && "bg-primary text-primary-foreground shadow-sm",
              )}
              aria-label="Abrir mais opcoes"
            >
              <MoreHorizontal className="size-5" />
              Mais
            </button>
          </DialogTrigger>
          <DialogContent className="bottom-0 top-auto w-full translate-y-0 rounded-b-none rounded-t-3xl border-x-0 border-b-0 p-0 sm:max-w-none">
            <DialogHeader className="border-b bg-primary p-5 text-primary-foreground">
              <DialogTitle className="text-base text-white">Mais opcoes</DialogTitle>
              <DialogDescription className="text-white/66">Acesso rapido aos fluxos do CRM, sincronizacao e saida da conta.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <div className="rounded-2xl border bg-secondary/45 p-3">
                <OfflineStatus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {moreItems.map((item) => (
                  <DialogClose key={item.href} asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 text-sm font-semibold shadow-sm transition active:scale-[0.99]",
                        isNavigationItemActive(pathname, item.href) && "border-primary/25 bg-primary text-primary-foreground",
                      )}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/80 text-primary">
                        <item.icon className="size-4" />
                      </span>
                      <span className="min-w-0 leading-tight">{item.label}</span>
                    </Link>
                  </DialogClose>
                ))}
              </div>
              <Button type="button" variant="ghost" className="min-h-12 w-full justify-start text-destructive" onClick={logout} disabled={isLoggingOut}>
                <span className="flex size-10 items-center justify-center rounded-xl bg-red-50 text-destructive dark:bg-red-950/35 dark:text-red-200">
                  <LogOut className="size-4" />
                </span>
                {isLoggingOut ? "Saindo..." : "Sair"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </nav>
  );
}

function BottomLink({ item, active }: { item: (typeof primaryItems)[number]; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "mobile-nav-item group flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold text-muted-foreground transition active:scale-[0.98]",
        active && "bg-primary text-primary-foreground shadow-sm",
      )}
    >
      <item.icon className="size-5" />
      <span>{item.label}</span>
    </Link>
  );
}
