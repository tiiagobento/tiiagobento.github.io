// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildPuterLeadPrompt } from "@/lib/ai/puter-lead-prompt";

describe("buildPuterLeadPrompt", () => {
  it("guides the AI to map WhatsApp image regions to CRM fields", () => {
    const prompt = buildPuterLeadPrompt({
      conversation: "",
      source: "WhatsApp",
      imageCount: 1,
    });

    expect(prompt).toContain("Topo do WhatsApp");
    expect(prompt).toContain("Mensagens brancas/esquerda");
    expect(prompt).toContain("Mensagens verdes/direita");
    expect(prompt).toContain("Mapa dos campos e onde procurar");
    expect(prompt).toContain("phone: topo da conversa ou cartao de contato");
    expect(prompt).toContain("next_step: proxima acao objetiva para o comercial");
    expect(prompt).toContain("Deltaville em Biguacu");
    expect(prompt).toContain("terreno 12x36");
    expect(prompt).toContain("audios sem transcricao visivel");
    expect(prompt).toContain("Pablo");
    expect(prompt).toContain("Cibelle");
    expect(prompt).toContain("Enzo Faure");
    expect(prompt).toContain("Karine");
    expect(prompt).toContain("Telefones internacionais");
  });
});
