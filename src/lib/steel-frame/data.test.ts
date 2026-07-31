import { describe, expect, it } from "vitest";

import { getSteelFrameErrorMessage, steelFrameMigrationRequiredMessage } from "./data";

describe("steel frame data errors", () => {
  it("turns missing migration errors into a useful setup message", () => {
    expect(getSteelFrameErrorMessage({ code: "42P01", message: "relation steel_frame_estimates does not exist" })).toBe(
      steelFrameMigrationRequiredMessage,
    );
  });

  it("does not expose database details when RLS rejects an operation", () => {
    expect(getSteelFrameErrorMessage({ code: "42501", message: "new row violates row-level security policy" })).toBe(
      "Sua conta nao possui permissao para executar esta acao no orcamento.",
    );
  });
});
