"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Plus, Search, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getVisibleNavigationItems, useActiveNavigation, useLogout, useNavigationRole } from "@/components/app-navigation";
import { OfflineStatus } from "@/components/offline-status";
import { cn } from "@/lib/utils";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard comercial",
  "/leads": "Leads",
  "/leads/ai-import": "Preencher lead com IA",
  "/pipeline": "Pipeline",
  "/tasks": "Acoes automatizadas",
  "/templates": "Templates WhatsApp",
  "/partner": "Painel do parceiro",
  "/import-export": "Importar e exportar",
  "/settings": "Configuracoes",
};

export function AppHeader() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const title = titles[pathname] ?? "Nova Forma CRM";
  const role = useNavigationRole();
  const visibleItems = getVisibleNavigationItems(role);
  const isActive = useActiveNavigation();
  const { logout, isLoggingOut, icon: LogoutIcon } = useLogout();

  return (
    <header className="app-safe-top sticky top-0 z-30 border-b bg-background/86 shadow-sm shadow-slate-950/[0.025] backdrop-blur-xl">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <MobileNavigation
            title={title}
            visibleItems={visibleItems}
            isActive={isActive}
            logout={logout}
            isLoggingOut={isLoggingOut}
            LogoutIcon={LogoutIcon}
          />
          <div className="min-w-0">
          <p className="hidden text-xs uppercase tracking-[0.18em] text-muted-foreground sm:block">Steel frame sales</p>
          <h2 className="truncate text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
          </div>
        </div>
        <div className="hidden min-w-80 items-center rounded-full border bg-card/92 px-4 shadow-sm shadow-slate-950/[0.035] transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15 md:flex">
          <Search className="mr-2 size-4 text-muted-foreground" />
          <Input className="border-0 bg-transparent px-0 focus-visible:ring-0" placeholder="Buscar lead, cidade, responsavel..." />
        </div>
        <div className="flex items-center gap-2">
          <OfflineStatus compact />
          <Button variant="outline" size="icon" className="size-11 min-h-11 min-w-11" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Alternar tema">
            <Sun className="size-4 dark:hidden" />
            <Moon className="hidden size-4 dark:block" />
          </Button>
          <Button asChild variant="outline" className="hidden lg:inline-flex">
            <Link href="/dashboard#nova-forma-ia">
              <Sparkles className="size-4" />
              Assistente
            </Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/leads/new">
              <Plus className="size-4" />
              Novo lead
            </Link>
          </Button>
          <Button type="button" variant="ghost" className="hidden lg:inline-flex" onClick={logout} disabled={isLoggingOut}>
            <LogoutIcon className="size-4" />
            {isLoggingOut ? "Saindo..." : "Sair"}
          </Button>
        </div>
      </div>
    </header>
  );
}

function MobileNavigation({
  title,
  visibleItems,
  isActive,
  logout,
  isLoggingOut,
  LogoutIcon,
}: {
  title: string;
  visibleItems: ReturnType<typeof getVisibleNavigationItems>;
  isActive: (href: string) => boolean;
  logout: () => Promise<void>;
  isLoggingOut: boolean;
  LogoutIcon: typeof Menu;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="size-11 min-h-11 min-w-11 shrink-0 lg:hidden" aria-label="Abrir menu">
          <Menu className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-dvh w-[min(23rem,100vw)] max-w-none translate-x-0 translate-y-0 rounded-none rounded-r-2xl p-0">
        <DialogHeader className="border-b bg-primary p-5 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent font-bold text-accent-foreground">NF</div>
            <div>
              <DialogTitle className="text-base text-white">Nova Forma CRM</DialogTitle>
              <DialogDescription className="text-xs text-white/65">{title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <nav className="space-y-1.5">
            {visibleItems.map((item) => {
              const active = isActive(item.href);
              return (
                <DialogClose key={item.href} asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-primary",
                      active && "bg-primary text-primary-foreground shadow-sm",
                    )}
                  >
                    <span className={cn("flex size-9 items-center justify-center rounded-lg bg-secondary text-primary", active && "bg-white/14 text-white")}>
                      <item.icon className="size-4" />
                    </span>
                    {item.label}
                  </Link>
                </DialogClose>
              );
            })}
          </nav>
          <div className="mt-auto border-t pt-4">
            <Button type="button" variant="ghost" className="min-h-12 w-full justify-start text-destructive hover:bg-red-50 hover:text-destructive dark:text-red-200 dark:hover:bg-red-950/35 dark:hover:text-red-100" onClick={logout} disabled={isLoggingOut}>
              <span className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-destructive dark:bg-red-950/35 dark:text-red-200">
                <LogoutIcon className="size-4" />
              </span>
              {isLoggingOut ? "Saindo..." : "Sair"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
