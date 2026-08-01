import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260801000000_steel_frame_phase_2_catalog_foundation.sql",
);

function normalizedSql() {
  return fs
    .readFileSync(migrationPath, "utf8")
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .toLowerCase();
}

describe("Steel Frame Phase 2 catalog migration contract", () => {
  it("is additive, has a baseline guard, and never seeds approved technical data", () => {
    const sql = normalizedSql();

    expect(sql).toContain("phase 2 baseline is incomplete");
    expect(sql).toContain("'steel_frame_suppliers'");
    expect(sql).toContain("create table if not exists public.steel_frame_technical_sources");
    expect(sql).toContain("create table if not exists public.steel_frame_material_coefficients");
    expect(sql).toContain("create table if not exists public.steel_frame_catalog_snapshots");
    expect(sql).not.toMatch(/drop\s+table/);
    expect(sql).not.toMatch(/truncate\s+/);
    expect(sql).not.toMatch(/delete\s+from\s+public\./);
    expect(sql).not.toMatch(/insert\s+into\s+public\.steel_frame_(technical_rules|technical_compositions|material_coefficients)[\s\S]*?approved/);
  });

  it("protects catalog data with RLS, immutable snapshots, and a private storage bucket", () => {
    const sql = normalizedSql();

    expect(sql).toContain("enable row level security");
    expect(sql).toContain("guard_steel_frame_catalog_snapshot_mutation");
    expect(sql).toContain("snapshots de catalogo sao imutaveis");
    expect(sql).toContain("'steel-frame-catalog'");
    expect(sql).toContain("public.can_manage_steel_frame_catalog()");
    expect(sql).toContain("public.can_read_steel_frame_financials(estimate_id)");
  });
});
