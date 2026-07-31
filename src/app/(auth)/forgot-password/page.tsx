"use client";

import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (!isSupabaseConfigured || !supabase) {
        const message = "Supabase nao configurado. Defina as variaveis de ambiente antes de recuperar a senha.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      setSent(true);
      toast.success("Enviamos o link de recuperacao para seu e-mail.");
    } catch (error) {
      const message = getAuthErrorMessage(error, "Erro ao enviar recuperacao de senha.");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Recuperar senha" description="Informe seu e-mail para receber um link seguro de redefinicao.">
      {sent ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            Se esse e-mail estiver cadastrado, voce recebera um link para criar uma nova senha. Confira tambem a caixa de spam.
          </div>
          <Button asChild className="w-full">
            <Link href="/login">Voltar para o login</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {errorMessage ? <AuthError message={errorMessage} /> : null}
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <Button className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Enviar link de recuperacao"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Lembrou a senha?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      )}
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
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/68">Recupere o acesso sem abrir chamado e volte para sua rotina comercial.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/8 p-4 text-sm text-white/72">O link de recuperacao e enviado pelo Supabase Auth e expira por seguranca.</div>
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
