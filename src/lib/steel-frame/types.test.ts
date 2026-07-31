import { describe, expect, it } from "vitest";
import { isSteelFrameEstimateFrozenStatus } from "./types";

describe("isSteelFrameEstimateFrozenStatus", () => {
  it("keeps editable workflow statuses open for updates", () => {
    expect(isSteelFrameEstimateFrozenStatus("draft")).toBe(false);
    expect(isSteelFrameEstimateFrozenStatus("needs_information")).toBe(false);
    expect(isSteelFrameEstimateFrozenStatus("in_review")).toBe(false);
  });

  it("marks approved and closed workflow statuses as read-only", () => {
    expect(isSteelFrameEstimateFrozenStatus("approved")).toBe(true);
    expect(isSteelFrameEstimateFrozenStatus("proposal_generated")).toBe(true);
    expect(isSteelFrameEstimateFrozenStatus("sent")).toBe(true);
    expect(isSteelFrameEstimateFrozenStatus("accepted")).toBe(true);
    expect(isSteelFrameEstimateFrozenStatus("expired")).toBe(true);
    expect(isSteelFrameEstimateFrozenStatus("cancelled")).toBe(true);
  });
});
