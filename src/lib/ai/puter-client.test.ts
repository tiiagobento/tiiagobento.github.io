import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeLeadImageWithPuter, analyzeLeadWithPuter, fileToDataUrl, waitForPuter } from "@/lib/ai/puter-client";

const analysisJson = JSON.stringify({
  leads: [
    {
      name: "Israel Forte",
      phone: "5551992653858",
      city: "Florianopolis",
      neighborhood: "",
      source: "WhatsApp",
      project_type: "Casa em steel frame",
      interest_type: "Orcamento",
      has_land: null,
      has_blueprint: true,
      urgency: "Antes de terminar projeto",
      notes: "Cliente pediu estimativa.",
      status: "Orcamento a enviar",
      priority: "Alta",
      next_step: "Pedir cidade e detalhes",
      lead_score: 75,
    },
  ],
  summary: "Lead com projeto em desenvolvimento.",
  warnings: [],
});

describe("puter client", () => {
  afterEach(() => {
    delete window.puter;
    vi.restoreAllMocks();
  });

  it("converts a local file to data URL", async () => {
    const file = new File(["hello"], "print.png", { type: "image/png" });
    await expect(fileToDataUrl(file)).resolves.toMatch(/^data:image\/png;base64,/);
  });

  it("returns friendly error when Puter is not loaded", async () => {
    await expect(waitForPuter(1)).rejects.toThrow("Nao consegui carregar a IA. Verifique sua conexao e tente novamente.");
  });

  it("calls Puter image analysis with model and image", async () => {
    const chat = vi.fn().mockResolvedValue(analysisJson);
    window.puter = { ai: { chat } };

    await expect(analyzeLeadImageWithPuter({ image: "data:image/png;base64,abc", prompt: "Analise" })).resolves.toBe(analysisJson);
    expect(chat).toHaveBeenCalledWith("Analise", "data:image/png;base64,abc", { model: "gpt-5.4-nano" });
  });

  it("returns friendly auth error when Puter asks for login", async () => {
    window.puter = { ai: { chat: vi.fn().mockRejectedValue(new Error("auth required")) } };

    await expect(analyzeLeadImageWithPuter({ image: "data:image/png;base64,abc", prompt: "Analise" })).rejects.toThrow(
      "O Puter pediu login/autorizacao. Conclua o acesso na janela do Puter e tente novamente.",
    );
  });

  it("analyzes mocked Puter response into leads", async () => {
    window.puter = { ai: { chat: vi.fn().mockResolvedValue(analysisJson) } };

    const result = await analyzeLeadWithPuter({ conversation: "Cliente quer orcamento", source: "WhatsApp" });

    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]).toMatchObject({ name: "Israel Forte", priority: "Alta" });
  });

  it("merges duplicated leads when the same WhatsApp conversation is split across images", async () => {
    const firstImageResult = JSON.stringify({
      leads: [
        {
          name: "David Cristiano Bagatini",
          phone: "554988230647",
          city: "Governador Celso Ramos",
          neighborhood: "",
          source: "WhatsApp",
          project_type: "Casa em steel frame",
          interest_type: "Chave na mao",
          has_land: true,
          has_blueprint: null,
          urgency: "",
          notes: "Cliente busca construtora chave na mao.",
          status: "Em triagem",
          priority: "Media",
          next_step: "Verificar com responsavel tecnico",
          lead_score: 55,
        },
      ],
      summary: "Primeira parte da conversa.",
      warnings: [],
    });
    const secondImageResult = JSON.stringify({
      leads: [
        {
          name: "David Cristiano Bagatini",
          phone: "554988230647",
          city: "Governador Celso Ramos",
          neighborhood: "",
          source: "WhatsApp",
          project_type: "Casa em steel frame",
          interest_type: "Chave na mao",
          has_land: true,
          has_blueprint: true,
          urgency: "Quer entender proximos passos",
          notes: "Terreno 12x36 com area de APP ao lado e documentacao disponivel.",
          status: "Orcamento a enviar",
          priority: "Alta",
          next_step: "Avaliar recuos e documentacao",
          lead_score: 82,
        },
      ],
      summary: "Segunda parte da conversa.",
      warnings: [],
    });

    window.puter = { ai: { chat: vi.fn().mockResolvedValueOnce(firstImageResult).mockResolvedValueOnce(secondImageResult) } };

    const result = await analyzeLeadWithPuter({
      conversation: "",
      source: "WhatsApp",
      images: ["data:image/jpeg;base64,one", "data:image/jpeg;base64,two"],
    });

    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]).toMatchObject({
      name: "David Cristiano Bagatini",
      phone: "554988230647",
      city: "Governador Celso Ramos",
      has_land: true,
      has_blueprint: true,
      priority: "Alta",
      status: "Orcamento a enviar",
      lead_score: 82,
    });
    expect(result.leads[0].notes).toContain("Cliente busca construtora chave na mao.");
    expect(result.leads[0].notes).toContain("Terreno 12x36 com area de APP");
  });
});
