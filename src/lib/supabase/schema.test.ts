import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "supabase/schema.sql"), "utf8");

describe("Supabase interaction follow-up trigger", () => {
  it("creates the follow-up task after a new interaction with a next contact", () => {
    expect(schema).toContain("create or replace function public.after_interaction_insert()");
    expect(schema).toContain("if new.next_contact_at is not null then");
    expect(schema).toContain("insert into public.tasks");
    expect(schema).toContain("create trigger interactions_after_insert after insert on public.interactions");
  });
});
