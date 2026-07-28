import { describe, expect, it } from "vitest";
import { accessPresets, formatPermissionOverrides, getPresetForRole, profileRoleLabel } from "@/lib/access-control";

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
});
