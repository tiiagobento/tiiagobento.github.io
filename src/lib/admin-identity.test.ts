import { describe, expect, it } from "vitest";
import { isPrimaryAdminEmail, isPrimaryAdminProfile, primaryAdminEmail } from "@/lib/admin-identity";

describe("primary admin identity", () => {
  it("recognizes Tiago's account as the primary administrator", () => {
    expect(primaryAdminEmail).toBe("tiagov.bento@gmail.com");
    expect(isPrimaryAdminEmail(" TIAGOV.BENTO@gmail.com ")).toBe(true);
    expect(isPrimaryAdminProfile({ email: "tiagov.bento@gmail.com" })).toBe(true);
    expect(isPrimaryAdminEmail("bruno@example.com")).toBe(false);
  });
});
