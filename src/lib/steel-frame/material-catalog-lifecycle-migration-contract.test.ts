import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260804000000_steel_frame_material_catalog_lifecycle.sql",
);

describe("Steel Frame material catalog lifecycle migration", () => {
  const migration = fs.readFileSync(migrationPath, "utf8");

  it("archives materials without deleting materials or price history", () => {
    expect(migration).toContain("create or replace function public.archive_steel_frame_material");
    expect(migration).toContain("add column if not exists archived_at");
    expect(migration).toContain("add column if not exists archive_reason");
    expect(migration).not.toMatch(/delete\s+from\s+public\.steel_frame_material/i);
  });

  it("registers a new preferred price and closes the previous period", () => {
    expect(migration).toContain("create or replace function public.register_steel_frame_material_price");
    expect(migration).toContain("effective_to = case");
    expect(migration).toContain("preferred = false");
    expect(migration).toContain("price_source_reference");
    expect(migration).toContain("true,");
  });

  it("audits base materials and prices and keeps RPCs private from public", () => {
    expect(migration).toContain("steel_frame_materials_catalog_audit");
    expect(migration).toContain("steel_frame_material_prices_catalog_audit");
    expect(migration).toContain("write_steel_frame_catalog_audit()");
    expect(migration).toContain("revoke all on function public.archive_steel_frame_material(uuid, text) from public");
  });
});
