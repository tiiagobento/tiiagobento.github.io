"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Link2, KeyRound, Loader2, Search, ShieldCheck, UserCheck, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { isPrimaryAdminProfile } from "@/lib/admin-identity";
import { accessPresets, buildPartnerAccountLink, formatPermissionOverrides, getEligiblePartnerAccounts, getLinkedPartnerAccounts, getPresetForRole, profileRoleLabel, type PermissionDefinition, type UserPermissionOverride } from "@/lib/access-control";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Profile, ProfileRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AuditEntry = {
  id: string;
  action: string;
  subject_user_id?: string | null;
  reason?: string | null;
  created_at: string;
};

type OverrideDraft = Record<string, boolean>;

export function AccessManagement({ profiles, leads, currentProfile, onChanged }: {
  profiles: Profile[];
  leads: Lead[];
  currentProfile: Profile | null;
  onChanged: () => Promise<void>;
}) {
  const [canManage, setCanManage] = React.useState<boolean | null>(null);
  const [permissions, setPermissions] = React.useState<PermissionDefinition[]>([]);
  const [overrides, setOverrides] = React.useState<UserPermissionOverride[]>([]);
  const [audits, setAudits] = React.useState<AuditEntry[]>([]);
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<"all" | ProfileRole>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = React.useState(true);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteName, setInviteName] = React.useState("");
  const [inviting, setInviting] = React.useState(false);
  const [partnerAccountId, setPartnerAccountId] = React.useState("none");
  const [linkingPartner, setLinkingPartner] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!supabase) return;
    setLoadingDetails(true);
    try {
      const { data: allowed, error: permissionError } = await supabase.rpc("has_permission", { permission_name: "users.manage" });
      if (permissionError && !isPrimaryAdminProfile(currentProfile)) throw permissionError;
      const canManageUsers = Boolean(allowed) || isPrimaryAdminProfile(currentProfile);
      setCanManage(canManageUsers);
      if (!canManageUsers) return;

      const [permissionResult, overrideResult, auditResult] = await Promise.all([
        supabase.from("permissions").select("key, label, category, description").order("category").order("label"),
        supabase.from("user_permission_overrides").select("user_id, permission_key, allowed, expires_at, reason"),
        supabase.from("admin_audit_log").select("id, action, subject_user_id, reason, created_at").order("created_at", { ascending: false }).limit(12),
      ]);
      if (permissionResult.error) throw permissionResult.error;
      if (overrideResult.error) throw overrideResult.error;
      if (auditResult.error) throw auditResult.error;
      setPermissions((permissionResult.data ?? []) as PermissionDefinition[]);
      setOverrides((overrideResult.data ?? []) as UserPermissionOverride[]);
      setAudits((auditResult.data ?? []) as AuditEntry[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar os acessos.");
      setCanManage(false);
    } finally {
      setLoadingDetails(false);
    }
  }, [currentProfile]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selected = profiles.find((profile) => profile.id === selectedId) ?? null;
  const eligiblePartnerAccounts = getEligiblePartnerAccounts(profiles, currentProfile?.id);
  const linkedPartnerAccounts = getLinkedPartnerAccounts(profiles);
  const filteredProfiles = profiles.filter((profile) => {
    const matchesQuery = `${profile.name ?? ""} ${profile.email ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (roleFilter === "all" || profile.role === roleFilter);
  });

  async function linkAccountAsPartner() {
    if (!supabase) return;
    const account = eligiblePartnerAccounts.find((profile) => profile.id === partnerAccountId);
    if (!account) {
      toast.error("Selecione uma conta ativa para vincular como parceiro.");
      return;
    }
    const accountLabel = account.name || account.email || "esta conta";
    if (!window.confirm(`Vincular ${accountLabel} como parceiro? A conta tera acesso apenas ao painel de parceiros e aos leads que forem atribuidos a ela.`)) return;

    setLinkingPartner(true);
    try {
      const { error } = await supabase.rpc("admin_update_user_access", buildPartnerAccountLink(account));
      if (error) throw error;
      toast.success(`${accountLabel} foi vinculado como parceiro.`);
      setPartnerAccountId("none");
      await onChanged();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel vincular a conta como parceiro.");
    } finally {
      setLinkingPartner(false);
    }
  }

  if (loadingDetails || canManage === null) {
    return <Card><CardContent className="flex min-h-48 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  if (!canManage) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center">
          <ShieldCheck className="size-8 text-muted-foreground" />
          <div><p className="font-semibold">Acesso administrativo necessario</p><p className="mt-1 text-sm text-muted-foreground">Sua conta nao possui permissao para administrar usuarios e acessos.</p></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="page-hero overflow-hidden">
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white/10 text-accent"><UsersRound className="size-5" /></div>
            <h1 className="text-2xl font-semibold">Usuarios e acessos</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/72">Controle papeis, acessos individuais e parceiros sem expor dados sensiveis.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2"><span className="block text-white/65">Ativos</span><strong>{profiles.filter((profile) => profile.active !== false).length}</strong></div>
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2"><span className="block text-white/65">Parceiros</span><strong>{profiles.filter((profile) => profile.role === "partner").length}</strong></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="size-5 text-accent" />Convidar usuario</CardTitle><CardDescription>O convite e enviado pelo Supabase Auth e nunca revela senha ou credenciais.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={async (event) => {
            event.preventDefault();
            setInviting(true);
            try {
              const response = await fetch("/api/admin/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail, name: inviteName }) });
              const body = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(body.error ?? "Nao foi possivel enviar o convite.");
              toast.success("Convite enviado. O usuario aparecera apos o Supabase criar o profile.");
              setInviteEmail("");
              setInviteName("");
              await onChanged();
              await load();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar o convite.");
            } finally {
              setInviting(false);
            }
          }}>
            <Input aria-label="Nome do usuario convidado" placeholder="Nome" value={inviteName} onChange={(event) => setInviteName(event.target.value)} />
            <Input aria-label="E-mail do usuario convidado" placeholder="email@empresa.com" type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
            <Button disabled={inviting}>{inviting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}Convidar</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-primary/15 bg-primary/[0.025]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 className="size-5 text-accent" />Vincular conta a parceiro</CardTitle>
          <CardDescription>Escolha uma conta ja cadastrada. Ela passara a ver somente o painel do parceiro, as notificacoes e os leads atribuidos a ela.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Conta cadastrada">
              <Select value={partnerAccountId} onValueChange={setPartnerAccountId}>
                <SelectTrigger aria-label="Conta para vincular como parceiro" className="w-full sm:min-w-80"><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecionar conta</SelectItem>
                  {eligiblePartnerAccounts.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.name || "Usuario sem nome"}{profile.email ? ` - ${profile.email}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Button type="button" disabled={linkingPartner || partnerAccountId === "none" || eligiblePartnerAccounts.length === 0} onClick={linkAccountAsPartner}>
              {linkingPartner ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}Vincular parceiro
            </Button>
          </div>
          {eligiblePartnerAccounts.length === 0 ? <p className="rounded-lg border border-dashed bg-background/70 p-3 text-sm text-muted-foreground">Nao ha contas ativas disponiveis. Convide ou ative uma conta para vincula-la como parceiro.</p> : null}
          {linkedPartnerAccounts.length ? <div className="rounded-xl border bg-background/75 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parceiros vinculados</p><div className="flex flex-wrap gap-2">{linkedPartnerAccounts.map((profile) => <button key={profile.id} type="button" onClick={() => setSelectedId(profile.id)} className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition hover:border-primary/35"><UserCheck className="size-3.5 text-accent" /><span>{profile.name || profile.email || "Parceiro"}</span><Badge variant={profile.active === false ? "danger" : "secondary"}>{profile.active === false ? "Inativo" : "Gerenciar"}</Badge></button>)}</div><p className="mt-3 text-xs text-muted-foreground">Para remover o papel de parceiro, primeiro reatribua os leads vinculados e depois use Gerenciar.</p></div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Equipe</CardTitle><CardDescription>Alteracoes de papel e permissoes ficam registradas na auditoria.</CardDescription></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar usuario" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as typeof roleFilter)}><SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os papeis</SelectItem><SelectItem value="admin">Administradores</SelectItem><SelectItem value="user">Usuarios</SelectItem><SelectItem value="partner">Parceiros</SelectItem><SelectItem value="custom">Personalizados</SelectItem></SelectContent></Select></div></CardHeader>
        <CardContent className="space-y-3">
          {filteredProfiles.map((profile) => {
            const leadCount = leads.filter((lead) => lead.partner_id === profile.id).length;
            const profileOverrides = formatPermissionOverrides(overrides.filter((override) => override.user_id === profile.id), permissions);
            return <button key={profile.id} type="button" onClick={() => setSelectedId(profile.id)} className="flex w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/25 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{profile.name || "Usuario sem nome"}</p><Badge variant={profile.active === false ? "danger" : "secondary"}>{profile.active === false ? "Inativo" : profileRoleLabel(profile.role)}</Badge></div><p className="mt-1 truncate text-sm text-muted-foreground">{profile.email || "E-mail indisponivel"}</p><div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground"><span>{leadCount} lead(s) atribuido(s)</span>{profileOverrides.slice(0, 2).map((override) => <span key={override.permission_key} className="rounded-full bg-secondary px-2 py-0.5">{override.allowed ? "Permite" : "Nega"}: {override.label}</span>)}</div></div><span className="text-sm font-medium text-primary">Gerenciar</span></button>;
          })}
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Auditoria recente</CardTitle><CardDescription>Alteracoes administrativas sem guardar senhas, tokens ou chaves.</CardDescription></CardHeader><CardContent className="space-y-2">{audits.length ? audits.map((audit) => <div key={audit.id} className="flex flex-col justify-between gap-1 rounded-lg border bg-secondary/20 p-3 text-sm sm:flex-row"><span className="font-medium">{audit.action}</span><span className="text-muted-foreground">{format(new Date(audit.created_at), "dd/MM HH:mm", { locale: ptBR })}{audit.reason ? ` - ${audit.reason}` : ""}</span></div>) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma alteracao administrativa registrada.</p>}</CardContent></Card>

      {selected ? <UserAccessDrawer profile={selected} profiles={profiles} permissions={permissions} initialOverrides={overrides.filter((override) => override.user_id === selected.id)} currentProfile={currentProfile} onClose={() => setSelectedId(null)} onSaved={async () => { await onChanged(); await load(); setSelectedId(null); }} /> : null}
    </div>
  );
}

function UserAccessDrawer({ profile, profiles, permissions, initialOverrides, currentProfile, onClose, onSaved }: { profile: Profile; profiles: Profile[]; permissions: PermissionDefinition[]; initialOverrides: UserPermissionOverride[]; currentProfile: Profile | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = React.useState(profile.name ?? "");
  const [role, setRole] = React.useState<ProfileRole>(profile.role);
  const [active, setActive] = React.useState(profile.active !== false);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<OverrideDraft>(() => Object.fromEntries(initialOverrides.map((override) => [override.permission_key, override.allowed])));
  const activeAdmins = profiles.filter((item) => item.role === "admin" && item.active !== false).length;
  const changingLastAdmin = profile.role === "admin" && profile.active !== false && activeAdmins <= 1 && (role !== "admin" || !active);

  async function save() {
    if (!supabase) return;
    if (changingLastAdmin) { toast.error("O ultimo administrador ativo nao pode ser removido ou desativado."); return; }
    if (!window.confirm(`Confirmar alteracoes de acesso para ${profile.name || profile.email || "este usuario"}?`)) return;
    setSaving(true);
    try {
      const requestedOverrides = Object.entries(draft).map(([permission_key, allowed]) => ({ permission_key, allowed, reason }));
      const { error } = await supabase.rpc("admin_update_user_access", { target_user_id: profile.id, requested_role: role, requested_active: active, requested_name: name.trim() || null, requested_overrides: requestedOverrides, action_reason: reason || null });
      if (error) throw error;
      toast.success("Acessos atualizados com seguranca.");
      await onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Nao foi possivel atualizar os acessos."); } finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 flex justify-end bg-foreground/25 p-0 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label="Gerenciar acesso"><section className="h-full w-full max-w-xl overflow-y-auto border-l bg-background p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-lg font-semibold">{profile.name || "Usuario"}</p><p className="text-sm text-muted-foreground">{profile.email}</p></div><Button type="button" variant="ghost" onClick={onClose}>Fechar</Button></div><div className="mt-6 space-y-5"><Field label="Nome"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome de exibicao" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Conjunto de acesso"><Select value={getPresetForRole(role)} onValueChange={(value) => setRole(accessPresets.find((preset) => preset.value === value)?.role ?? "custom")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accessPresets.map((preset) => <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>)}</SelectContent></Select></Field><div className="rounded-xl border p-3"><label className="flex cursor-pointer items-center justify-between gap-3"><span><span className="block text-sm font-medium">Acesso ativo</span><span className="block text-xs text-muted-foreground">Remove o acesso aos dados imediatamente.</span></span><input aria-label="Acesso ativo" type="checkbox" className="size-5 accent-primary" checked={active} onChange={(event) => setActive(event.target.checked)} /></label></div></div><Field label="Motivo da alteracao"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Opcional, fica no historico administrativo" /></Field><div><div className="mb-3 flex items-center gap-2"><KeyRound className="size-4 text-accent" /><Label>Permissoes individuais</Label></div><p className="mb-3 text-xs text-muted-foreground">Ative para conceder ou desative para revogar uma permissao especifica. Elas prevalecem sobre o conjunto padrao.</p><div className="space-y-2">{permissions.map((permission) => <label key={permission.key} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={draft[permission.key] === true} onChange={(event) => setDraft((current) => ({ ...current, [permission.key]: event.target.checked }))} /><span><span className="block text-sm font-medium">{permission.label}</span><span className="block text-xs text-muted-foreground">{permission.category}{permission.description ? ` - ${permission.description}` : ""}</span></span></label>)}</div></div><Button type="button" className="w-full" disabled={saving || (currentProfile?.id === profile.id && changingLastAdmin)} onClick={save}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Salvar acesso</Button></div></section></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
