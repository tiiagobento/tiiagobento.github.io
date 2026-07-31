"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [hasRecoverySession, setHasRecoverySession] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const sessionCheckFallback = window.setTimeout(() => {
      if (active) setCheckingSession(false);
    }, 3_000);

    async function checkSession() {
      if (!isSupabaseConfigured || !supabase) {
        window.clearTimeout(sessionCheckFallback);
        if (active) {
          setCheckingSession(false);
          setErrorMessage("Supabase nao configurado. Defina as variaveis de ambiente antes de redefinir a senha.");
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      window.clearTimeout(sessionCheckFallback);
      setHasRecoverySession(Boolean(session));
      setCheckingSession(false);
    }

    void checkSession();

    return () => {
      active = false;
      window.clearTimeout(sessionCheckFallback);
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (password.length < 6) {
      const message = "Use uma senha com pelo menos 6 caracteres.";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (password !== confirmPassword) {
      const message = "As senhas nao conferem.";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        const message = "Supabase nao configurado. Defina as variaveis de ambiente antes de redefinir a senha.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Senha atualizada com sucesso. Entre novamente para continuar.");
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      const message = getAuthErrorMessage(error, "Erro ao redefinir senha.");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <AuthShell title="Criar nova senha" description="Validando o link seguro de recuperacao.">
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-md bg-secondary" />
          <div className="h-10 animate-pulse rounded-md bg-secondary" />
          <div className="h-10 animate-pulse rounded-md bg-secondary" />
        </div>
      </AuthShell>
    );
  }

  if (!hasRecoverySession) {
    return (
      <AuthShell title="Link invalido ou expirado" description="Solicite um novo link para redefinir sua senha.">
        <div className="space-y-4">
          {errorMessage ? <AuthError message={errorMessage} /> : null}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Nao encontramos uma sessao valida de recuperacao. O link pode ter expirado ou ja ter sido usado.
          </div>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Enviar novo link</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Criar nova senha" description="Defina uma senha nova para acessar o CRM.">
      <form onSubmit={submit} className="space-y-4">
        {errorMessage ? <AuthError message={errorMessage} /> : null}
        <div className="space-y-2">
          <Label>Nova senha</Label>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
        </div>
        <div className="space-y-2">
          <Label>Confirmar nova senha</Label>
          <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} />
        </div>
        <Button className="w-full" disabled={loading}>
          {loading ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </AuthShell>
  );
}

function AuthError({ message }: { message: string }) {
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</div>;
}

function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(184,117,53,0.32),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_28%),linear-gradient(135deg,#0d2b36,#172027)] p-4">
      <Card className="grid w-full max-w-5xl overflow-hidden border-white/10 bg-white/96 shadow-2xl shadow-slate-950/30 md:grid-cols-[1fr_1.05fr] dark:border-white/10 dark:bg-card/95 dark:shadow-black/50">
        <div className="hidden bg-primary p-8 text-primary-foreground md:flex md:flex-col md:justify-between">
          <div>
            <BrandLogo variant="complete" className="w-full max-w-sm rounded-xl shadow-xl shadow-slate-950/20" priority />
            <h1 className="mt-6 text-3xl font-semibold">Nova Forma CRM</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/68">Defina uma nova senha e mantenha sua operacao comercial protegida.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/8 p-4 text-sm text-white/72">Depois da troca, a sessao e encerrada para voce entrar novamente com a nova senha.</div>
        </div>
        <div>
          <CardHeader className="space-y-2 p-6 sm:p-8">
            <BrandLogo className="mb-2 w-36 rounded-lg shadow-sm md:hidden" priority />
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">{children}</CardContent>
        </div>
      </Card>
    </main>
  );
}
