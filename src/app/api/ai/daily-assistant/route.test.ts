import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const providerMocks = vi.hoisted(() => ({ generate: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })) },
  })),
}));

vi.mock("@/lib/ai/provider", () => ({
  AIConfigurationError: class AIConfigurationError extends Error {},
  getConfiguredAIProvider: vi.fn(() => ({ name: "mock", supportsImages: true, generate: providerMocks.generate })),
}));

function request(body: unknown) {
  return new Request("http://localhost/api/ai/daily-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const action = {
  id: "task:follow-up-1",
  title: "Retomar contato com Carlos",
  reason: "Lead quente aguardando resposta.",
  context: "Biguacu / Deltaville",
  stage: "Orcamento enviado",
  source: "Site",
  estimated_minutes: 3,
  score: 820,
  lead_name: "Carlos Eduardo",
};

describe("POST /api/ai/daily-assistant", () => {
  beforeEach(() => {
    providerMocks.generate.mockReset();
    providerMocks.generate.mockResolvedValue(JSON.stringify({
      message: "Comece pelo Carlos: ele e um lead quente aguardando resposta.",
      suggested_action_id: action.id,
      missing_information: ["melhor horario para contato"],
      suggested_question: "Qual horario fica melhor para conversarmos?",
    }));
  });

  it("returns a validated recommendation for real CRM actions", async () => {
    const response = await POST(request({ mode: "welcome", profile_name: "Tiago", actions: [action] }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ suggested_action_id: action.id, missing_information: ["melhor horario para contato"] });
    expect(providerMocks.generate).toHaveBeenCalledWith(expect.objectContaining({
      task: "daily-assistant",
      images: [],
      prompt: expect.stringContaining(action.title),
    }));
  });

  it("removes a suggested action id that was not provided by the CRM", async () => {
    providerMocks.generate.mockResolvedValue(JSON.stringify({
      message: "Revise o proximo contato antes de seguir.",
      suggested_action_id: "lead-inventado",
      missing_information: [],
      suggested_question: null,
    }));

    const response = await POST(request({ mode: "priorities", actions: [action] }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.suggested_action_id).toBeNull();
  });

  it("rejects an oversized planning payload before calling the provider", async () => {
    const response = await POST(request({ mode: "welcome", actions: Array.from({ length: 13 }, () => action) }));

    expect(response.status).toBe(400);
    expect(providerMocks.generate).not.toHaveBeenCalled();
  });
});
