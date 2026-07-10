import type { AIProvider } from "@/lib/ai/provider-types";

export function createMockProvider(): AIProvider {
  return {
    name: "mock",
    supportsImages: true,
    async generate(input) {
      if (input.task === "generate-message") {
        return JSON.stringify({
          message: "Olá! Aqui é da Nova Forma Steel Frame. Recebemos seu contato e queremos entender melhor o seu projeto. Em qual cidade e bairro será a obra?",
          warnings: ["Resposta gerada pelo provider mock para desenvolvimento."],
        });
      }

      return JSON.stringify({
        leads: [
          {
            name: "Lead de desenvolvimento",
            phone: "5548999999999",
            city: "Biguaçu",
            neighborhood: "",
            source: "WhatsApp",
            project_type: "Casa em steel frame",
            interest_type: "Orçamento",
            has_land: null,
            has_blueprint: null,
            urgency: "",
            notes: input.images.length > 0
              ? "Rascunho gerado pelo provider mock a partir de imagem de teste. Revise antes de salvar."
              : "Rascunho gerado pelo provider mock. Revise antes de salvar.",
            status: "Novo lead",
            priority: "Média",
            next_step: "Confirmar cidade, bairro, terreno e projeto",
            lead_score: 35,
          },
        ],
        summary: "Exemplo de extração para desenvolvimento local.",
        warnings: ["Provider mock ativo: os dados não vieram de uma IA real."],
      });
    },
  };
}
