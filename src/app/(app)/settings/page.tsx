"use client";

import { useRouter } from "next/navigation";
import { Cloud, CloudOff, Database, RefreshCw, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrmData } from "@/hooks/use-crm-data";
import { discardPendingOperation } from "@/lib/offline/sync-queue";

export default function SettingsPage() {
  const router = useRouter();
  const { configurationError, userEmail, signOut, isOnline, syncing, syncSummary, syncNow, retrySync, refresh } = useCrmData();
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
      <Card className="lg:col-span-2">
        <CardHeader>
          {isOnline ? <Cloud className="size-6 text-accent" /> : <CloudOff className="size-6 text-accent" />}
          <CardTitle>Sincronizacao offline</CardTitle>
          <CardDescription>
            {isOnline ? "Online. Alteracoes pendentes podem ser enviadas ao Supabase." : "Offline - alteracoes serao sincronizadas depois."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-secondary/35 p-3">
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-semibold text-primary">{syncSummary.pending}</p>
            </div>
            <div className="rounded-xl border bg-secondary/35 p-3">
              <p className="text-xs text-muted-foreground">Com erro</p>
              <p className="text-2xl font-semibold text-primary">{syncSummary.failed}</p>
            </div>
            <div className="rounded-xl border bg-secondary/35 p-3">
              <p className="text-xs text-muted-foreground">Conflitos</p>
              <p className="text-2xl font-semibold text-primary">{syncSummary.conflict}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={syncNow} disabled={!isOnline || syncing}>
              <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
              {syncing ? "Sincronizando..." : "Sincronizar agora"}
            </Button>
            <Button type="button" variant="outline" onClick={retrySync} disabled={!isOnline || syncing || syncSummary.failed === 0}>
              <TriangleAlert className="size-4" />
              Tentar novamente
            </Button>
          </div>
          {syncSummary.operations.length ? (
            <div className="space-y-2">
              {syncSummary.operations.map((operation) => (
                <div key={operation.id} className="flex flex-col gap-3 rounded-xl border bg-card p-3 text-sm shadow-xs sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {operation.entity} / {operation.operation}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status: {operation.status} - {new Date(operation.updated_at).toLocaleString("pt-BR")}
                    </p>
                    {operation.last_error ? <p className="mt-1 text-xs text-destructive">{operation.last_error}</p> : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await discardPendingOperation(operation.id);
                      await refresh();
                    }}
                  >
                    <Trash2 className="size-4" />
                    Descartar local
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed bg-card/70 p-4 text-sm text-muted-foreground">Nenhuma operacao pendente neste dispositivo.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
