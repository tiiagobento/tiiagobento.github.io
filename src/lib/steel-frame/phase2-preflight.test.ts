import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const preflightPath = path.resolve(
  process.cwd(),
  "supabase/verification/steel_frame_phase2_preflight.sql",
);

function withoutNonExecutableSqlContent(sql: string) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:''|[^'])*'/g, "''");
}

describe("Steel Frame Phase 2 Supabase preflight", () => {
  const preflight = readFileSync(preflightPath, "utf8");

  it("covers the required baseline objects and the Phase 2 gate", () => {
    for (const requiredObject of [
      "profiles",
      "leads",
      "tasks",
      "user_permission_overrides",
      "admin_audit_log",
      "partner_commissions",
      "lead_files",
      "push_device_tokens",
      "push_notification_deliveries",
      "steel_frame_estimates",
      "steel_frame_estimate_versions",
      "steel_frame_suppliers",
      "steel_frame_materials",
      "steel_frame_material_prices",
      "steel_frame_documents",
      "steel_frame_wall_segments",
      "steel_frame_openings",
      "steel_frame_reinforcement_templates",
      "steel_frame_technical_rules",
      "steel_frame_technical_assessments",
      "public.has_permission(text)",
      "steel-frame-documents",
      "lead-files",
      "steel-frame-catalog",
      "partial_baseline_blocked",
      "READY_FOR_PHASE2_HOMOLOGATION",
    ]) {
      expect(preflight).toContain(requiredObject);
    }
  });

  it("remains a read-only verification query", () => {
    const executableSql = withoutNonExecutableSqlContent(preflight);

    expect(executableSql).not.toMatch(
      /\b(?:create|alter|insert|update|delete|drop|grant|revoke|truncate)\b/i,
    );
  });
});
