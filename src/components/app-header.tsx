"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Plus, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  return (
    <header className="sticky top-0 z-30 border-b bg-background/88 shadow-sm shadow-slate-950/[0.025] backdrop-blur-xl">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Steel frame sales</p>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        </div>
        <div className="hidden min-w-80 items-center rounded-full border bg-card/90 px-4 shadow-sm md:flex">
          <Search className="mr-2 size-4 text-muted-foreground" />
          <Input className="border-0 bg-transparent px-0 focus-visible:ring-0" placeholder="Buscar lead, cidade, responsavel..." />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Alternar tema">
            <Sun className="size-4 dark:hidden" />
            <Moon className="hidden size-4 dark:block" />
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/leads/new">
              <Plus className="size-4" />
              Novo lead
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
