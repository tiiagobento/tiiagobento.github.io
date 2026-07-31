import type { Profile, ProfileRole } from "@/lib/types";

export type AccessPreset = "admin" | "user" | "partner" | "readonly" | "custom";

export type PermissionDefinition = {
  key: string;
  label: string;
  category: string;
  description?: string | null;
};

export type UserPermissionOverride = {
  user_id: string;
  permission_key: string;
  allowed: boolean;
  expires_at?: string | null;
  reason?: string | null;
};

export const accessPresets: Array<{ value: AccessPreset; label: string; role: ProfileRole; description: string }> = [
  { value: "admin", label: "Administrador completo", role: "admin", description: "Acesso operacional e administrativo completo." },
  { value: "user", label: "Usuario padrao", role: "user", description: "Trabalha apenas com a propria carteira e tarefas." },
  { value: "partner", label: "Parceiro padrao", role: "partner", description: "Ve somente visitas, briefings e leads atribuidos." },
  { value: "readonly", label: "Somente leitura", role: "custom", description: "Acesso personalizado sem permissoes de alteracao." },
  { value: "custom", label: "Personalizado", role: "custom", description: "Permissoes individuais definidas pelo administrador." },
];

export function getPresetForRole(role: ProfileRole): AccessPreset {
  return role === "admin" || role === "partner" || role === "user" ? role : "custom";
}

export function profileRoleLabel(role: ProfileRole) {
  return {
    admin: "Administrador",
    partner: "Parceiro",
    user: "Usuario",
    custom: "Personalizado",
  }[role];
}

export function formatPermissionOverrides(overrides: UserPermissionOverride[], permissions: PermissionDefinition[]) {
  const labels = new Map(permissions.map((permission) => [permission.key, permission.label]));
  return overrides.map((override) => ({
    ...override,
    label: labels.get(override.permission_key) ?? override.permission_key,
  }));
}

export type AuditedPermissionChange = {
  permission_key: string;
  allowed: boolean;
};

/** Converts persisted audit payloads into the same human labels used by the access drawer. */
export function formatAuditedPermissionChanges(changes: AuditedPermissionChange[] | undefined, permissions: PermissionDefinition[]) {
  const labels = new Map(permissions.map((permission) => [permission.key, permission.label]));
  return (changes ?? []).map((change) => ({
    ...change,
    label: labels.get(change.permission_key) ?? change.permission_key,
  }));
}

/** Accounts that an administrator can safely turn into partners. */
export function getEligiblePartnerAccounts(profiles: Profile[], currentUserId?: string | null) {
  return profiles.filter((profile) => profile.active !== false && profile.role !== "partner" && profile.id !== currentUserId);
}

export function getLinkedPartnerAccounts(profiles: Profile[]) {
  return profiles.filter((profile) => profile.role === "partner");
}

export function buildPartnerAccountLink(profile: Profile) {
  return {
    target_user_id: profile.id,
    requested_role: "partner" as const,
    requested_active: profile.active !== false,
    requested_name: profile.name ?? null,
    requested_overrides: [],
    action_reason: "Conta vinculada como parceiro pela central de acessos.",
  };
}
