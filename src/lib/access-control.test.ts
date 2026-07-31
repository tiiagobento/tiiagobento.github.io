import { describe, expect, it } from "vitest";
import { accessPresets, buildPartnerAccountLink, formatAuditedPermissionChanges, formatPermissionOverrides, getEligiblePartnerAccounts, getLinkedPartnerAccounts, getPresetForRole, profileRoleLabel } from "@/lib/access-control";

describe("access control helpers", () => {
  it("keeps stable presets for the supported roles", () => {
    expect(getPresetForRole("admin")).toBe("admin");
    expect(getPresetForRole("partner")).toBe("partner");
    expect(getPresetForRole("user")).toBe("user");
    expect(getPresetForRole("custom")).toBe("custom");
    expect(accessPresets.map((preset) => preset.value)).toEqual(["admin", "user", "partner", "readonly", "custom"]);
  });

  it("renders human labels without exposing internal permission keys", () => {
    expect(profileRoleLabel("custom")).toBe("Personalizado");
    expect(formatPermissionOverrides(
      [{ user_id: "partner-1", permission_key: "briefings.view_assigned", allowed: true }],
      [{ key: "briefings.view_assigned", label: "Ver briefing atribuido", category: "Visitas" }],
    )).toEqual([expect.objectContaining({ label: "Ver briefing atribuido", allowed: true })]);
  });

  it("renders persisted permission audit details with human labels", () => {
    expect(formatAuditedPermissionChanges(
      [{ permission_key: "leads.view_assigned", allowed: true }],
      [{ key: "leads.view_assigned", label: "Ver leads atribuidos", category: "Leads" }],
    )).toEqual([{ permission_key: "leads.view_assigned", allowed: true, label: "Ver leads atribuidos" }]);
  });

  it("only offers active non-partner accounts for a partner link", () => {
    const profiles = [
      { id: "admin-1", name: "Admin", role: "admin" as const, active: true },
      { id: "user-1", name: "Bruno", role: "user" as const, active: true },
      { id: "partner-1", name: "Rafael", role: "partner" as const, active: true },
      { id: "inactive-1", name: "Conta inativa", role: "user" as const, active: false },
    ];

    expect(getEligiblePartnerAccounts(profiles).map((profile) => profile.id)).toEqual(["admin-1", "user-1"]);
    expect(getEligiblePartnerAccounts(profiles, "admin-1").map((profile) => profile.id)).toEqual(["user-1"]);
    expect(getLinkedPartnerAccounts(profiles).map((profile) => profile.id)).toEqual(["partner-1"]);
    expect(buildPartnerAccountLink(profiles[1])).toMatchObject({
      target_user_id: "user-1",
      requested_role: "partner",
      requested_active: true,
      action_reason: expect.stringContaining("parceiro"),
    });
  });
});
