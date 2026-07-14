import { describe, expect, it } from "vitest";
import { automationStorageKey, readAutomationLevel, saveAutomationLevel } from "@/lib/automation-preferences";

describe("automation preferences", () => {
  it("uses semi-automatic as the safe default and persists a valid selection", () => {
    window.localStorage.removeItem(automationStorageKey("user-1"));
    expect(readAutomationLevel("user-1")).toBe("semi-automatic");

    saveAutomationLevel("assisted", "user-1");
    expect(readAutomationLevel("user-1")).toBe("assisted");
  });
});
