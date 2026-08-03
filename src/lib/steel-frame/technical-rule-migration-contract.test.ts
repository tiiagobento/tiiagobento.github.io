import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/add_steel_frame_technical_rules.sql",
);

describe("Steel Frame technical rule migration contract", () => {
  it("quotes the PostgreSQL origin keyword in the rule definition", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain(
      `"origin" text not null check ("origin" in ('standard', 'manufacturer', 'company', 'technical_responsible'))`,
    );
    expect(migration).not.toContain(
      `origin text not null check (origin in ('standard', 'manufacturer', 'company', 'technical_responsible'))`,
    );
  });
});
