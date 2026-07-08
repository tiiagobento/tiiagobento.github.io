"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const nextPath = typeof window === "undefined" ? "/dashboard" : new URLSearchParams(window.location.search).get("next") ?? "/dashboard";

  React.useEffect(() => {
    let active = true;

    async function checkSession() {
      if (!isSupabaseConfigured || !supabase) {
        if (active) setCheckingSession(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (user) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setCheckingSession(false);
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      if (!isSupabaseConfigured || !supabase) {
        const message = "Supabase nao configurado. Defina as variaveis de ambiente antes de entrar.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Login realizado com sucesso.");
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      const message = getAuthErrorMessage(error, "Erro ao entrar.");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <AuthShell title="Entrar no CRM" description="Verificando sessao segura do Supabase.">
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-md bg-secondary" />
          <div className="h-10 animate-pulse rounded-md bg-secondary" />
          <div className="h-10 animate-pulse rounded-md bg-secondary" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Entrar no CRM" description="Acesse sua operacao comercial da Nova Forma.">
      <form onSubmit={submit} className="space-y-4">
        {errorMessage ? <AuthError message={errorMessage} /> : null}
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Senha</Label>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        <Button className="w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Ainda nao tem conta?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Criar cadastro
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function AuthError({ message }: { message: string }) {
  return <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</div>;
}

function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#fff7ed,transparent_34%),linear-gradient(135deg,#12323b,#172027)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
