import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const postflightPath = path.resolve(
  process.cwd(),
  "supabase/verification/steel_frame_phase2_catalog_postflight.sql",
);

function withoutNonExecutableSqlContent(sql: string) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:''|[^'])*'/g, "''");
}

describe("Steel Frame Phase 2 catalog postflight", () => {
  const postflight = readFileSync(postflightPath, "utf8");

  it("covers catalog tables, RLS, policies, triggers and private storage", () => {
    for (const requiredObject of [
      "steel_frame_technical_sources",
      "steel_frame_material_coefficients",
      "steel_frame_technical_composition_layers",
      "steel_frame_estimate_scenarios",
      "steel_frame_catalog_snapshots",
      "steel_frame_catalog_audit_logs",
      "steel-frame-catalog",
      "steel_frame_catalog_storage_insert_manage",
      "steel_frame_technical_sources_updated_at",
      "PHASE2_CATALOG_READY",
      "PHASE2_CATALOG_BLOCKED",
    ]) {
      expect(postflight).toContain(requiredObject);
    }
  });

  it("remains a read-only verification query", () => {
    const executableSql = withoutNonExecutableSqlContent(postflight);

    expect(executableSql).not.toMatch(
      /\b(?:create|alter|insert|update|delete|drop|grant|revoke|truncate)\b/i,
    );
  });
});
