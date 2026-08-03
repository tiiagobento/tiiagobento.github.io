import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260803000000_steel_frame_cost_item_lifecycle.sql",
);

describe("Steel Frame cost item lifecycle migration", () => {
  const migration = fs.readFileSync(migrationPath, "utf8");

  it("archives all cost item types without deleting their history", () => {
    expect(migration).toContain("add column if not exists archived_at");
    expect(migration).toContain("add column if not exists archived_by");
    expect(migration).toContain("add column if not exists archive_reason");
    expect(migration).toContain("'steel_frame_calculated_items'");
    expect(migration).toContain("'steel_frame_labor_items'");
    expect(migration).toContain("'steel_frame_operational_costs'");
    expect(migration).not.toMatch(/delete\s+from\s+public\.steel_frame_/i);
  });

  it("audits lifecycle changes and keeps the function private", () => {
    expect(migration).toContain("create or replace function public.audit_steel_frame_cost_item_change()");
    expect(migration).toContain("'cost_item.archived'");
    expect(migration).toContain("after insert or update or delete");
    expect(migration).toContain(
      "revoke all on function public.audit_steel_frame_cost_item_change() from public",
    );
  });
});
