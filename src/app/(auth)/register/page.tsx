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

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const sessionCheckFallback = window.setTimeout(() => {
      if (active) setCheckingSession(false);
    }, 3_000);

    async function checkSession() {
      if (!isSupabaseConfigured || !supabase) {
        window.clearTimeout(sessionCheckFallback);
        if (active) setCheckingSession(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      window.clearTimeout(sessionCheckFallback);

      if (session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setCheckingSession(false);
    }

    void checkSession();

    return () => {
      active = false;
      window.clearTimeout(sessionCheckFallback);
    };
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      if (!isSupabaseConfigured || !supabase) {
        const message = "Supabase nao configurado. Defina as variaveis de ambiente antes de cadastrar.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (error) throw error;

      if (data.session) {
        toast.success("Cadastro criado com sucesso.");
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      toast.success("Cadastro criado. Confira seu e-mail para confirmar o acesso.");
      router.replace("/login");
    } catch (error) {
      const message = getAuthErrorMessage(error, "Erro ao cadastrar.");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <AuthShell title="Criar acesso" description="Verificando sessao segura do Supabase.">
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-md bg-secondary" />
          <div className="h-10 animate-pulse rounded-md bg-secondary" />
          <div className="h-10 animate-pulse rounded-md bg-secondary" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Criar acesso" description="Cadastre o usuario que vai operar o CRM.">
      <form onSubmit={submit} className="space-y-4">
        {errorMessage ? <AuthError message={errorMessage} /> : null}
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Senha</Label>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
        </div>
        <Button className="w-full" disabled={loading}>
          {loading ? "Cadastrando..." : "Cadastrar"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Ja tem conta?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(184,117,53,0.32),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_28%),linear-gradient(135deg,#0d2b36,#172027)] p-4">
      <Card className="grid w-full max-w-5xl overflow-hidden border-white/10 bg-white/96 shadow-2xl shadow-slate-950/30 md:grid-cols-[1fr_1.05fr] dark:border-white/10 dark:bg-card/95 dark:shadow-black/50">
        <div className="hidden bg-primary p-8 text-primary-foreground md:flex md:flex-col md:justify-between">
          <div>
            <div className="flex size-12 items-center justify-center rounded-xl bg-accent font-bold text-accent-foreground shadow-lg shadow-accent/20">NF</div>
            <h1 className="mt-6 text-3xl font-semibold">Nova Forma CRM</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/68">Organize leads, visitas e follow-ups em uma operacao comercial limpa e profissional.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/8 p-4 text-sm text-white/72">Cadastro conectado ao Supabase Auth com perfil criado automaticamente pelo banco.</div>
        </div>
        <div>
        <CardHeader className="space-y-2 p-6 sm:p-8">
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground md:hidden">NF</div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">{children}</CardContent>
        </div>
      </Card>
    </main>
  );
}

function AuthError({ message }: { message: string }) {
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</div>;
}
