import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260802000000_steel_frame_supplier_quote_history.sql",
);

function normalizedSql() {
  return fs
    .readFileSync(migrationPath, "utf8")
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .toLowerCase();
}

describe("Steel Frame supplier quote history migration contract", () => {
  it("is additive and stores reviewed quotes independently from active catalog prices", () => {
    const sql = normalizedSql();

    expect(sql).toContain("create table if not exists public.steel_frame_supplier_quotes");
    expect(sql).toContain("create table if not exists public.steel_frame_supplier_quote_items");
    expect(sql).toContain("a quote never creates a catalog price automatically");
    expect(sql).not.toMatch(/drop\s+table/);
    expect(sql).not.toMatch(/truncate\s+/);
    expect(sql).not.toMatch(/delete\s+from\s+public\./);
  });

  it("requires a matching private supplier quote source and protects historic rows with RLS", () => {
    const sql = normalizedSql();

    expect(sql).toContain("source_row.source_type = 'supplier_quote'");
    expect(sql).toContain("cotacoes de fornecedor sao historicas e imutaveis");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("public.can_manage_steel_frame_catalog()");
    expect(sql).toContain("create_steel_frame_supplier_quote");
  });
});
