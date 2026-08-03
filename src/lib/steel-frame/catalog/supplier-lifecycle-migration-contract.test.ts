import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260805000000_steel_frame_supplier_lifecycle.sql",
);

describe("Steel Frame supplier lifecycle migration", () => {
  const migration = fs.readFileSync(migrationPath, "utf8");

  it("adds archival metadata and preserves historic supplier references", () => {
    expect(migration).toContain("alter table public.steel_frame_suppliers");
    expect(migration).toContain("add column if not exists archived_at");
    expect(migration).toContain("create or replace function public.archive_steel_frame_supplier");
    expect(migration).not.toMatch(/delete\s+from\s+public\.steel_frame_/i);
    expect(migration).not.toMatch(/truncate\s+/i);
    expect(migration).not.toMatch(/drop\s+(table|column)/i);
  });

  it("blocks physical deletion and silent reactivation", () => {
    expect(migration).toContain("Fornecedores possuem historico comercial e nao podem ser excluidos");
    expect(migration).toContain("Fornecedores arquivados sao imutaveis");
    expect(migration).toContain("O arquivamento exige autor, data e motivo");
  });

  it("requires catalog permission and writes audit history", () => {
    expect(migration).toContain("public.can_manage_steel_frame_catalog()");
    expect(migration).toContain("steel_frame_suppliers_catalog_audit");
    expect(migration).toContain("public.write_steel_frame_catalog_audit()");
    expect(migration).toContain("revoke all on function public.archive_steel_frame_supplier(uuid, text) from public");
  });
});
