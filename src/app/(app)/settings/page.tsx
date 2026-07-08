"use client";

import { useRouter } from "next/navigation";
import { Database, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrmData } from "@/hooks/use-crm-data";

export default function SettingsPage() {
  const router = useRouter();
  const { configurationError, userEmail, signOut } = useCrmData();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <ShieldCheck className="size-6 text-accent" />
          <CardTitle>Conta</CardTitle>
          <CardDescription>{userEmail ?? "Sem usuario autenticado"}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{configurationError ?? "Supabase conectado. Os dados exibidos sao consultados com a sessao autenticada e protegidos por RLS."}</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={async () => {
              try {
                await signOut();
                router.replace("/login");
                router.refresh();
              } catch {
                router.replace("/login");
                router.refresh();
              }
            }}
          >
            Sair
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Database className="size-6 text-accent" />
          <CardTitle>Banco de dados</CardTitle>
          <CardDescription>Supabase Postgres + Row Level Security</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Execute o arquivo `supabase/schema.sql` no SQL Editor do Supabase. Para popular dados de teste no banco real, use a funcao `public.seed_nova_forma_demo` com o UUID do usuario.</p>
        </CardContent>
      </Card>
    </div>
  );
}
