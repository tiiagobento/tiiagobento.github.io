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

      if (input.task === "daily-assistant") {
        return JSON.stringify({
          message: "Comece pelo contato mais urgente. Ele tem contexto comercial suficiente para um proximo passo objetivo.",
          suggested_action_id: null,
          missing_information: ["bairro da obra"],
          suggested_question: "Em qual bairro sera a obra?",
        });
      }

      if (input.task === "extract-estimate") {
        return JSON.stringify({
          summary: "Analise simulada para desenvolvimento. Revise todas as medidas antes de usar no orcamento.",
          estimate: {
            title: "Orcamento Steel Frame - em revisao",
            city: null,
            neighborhood: null,
            approximate_address: null,
            project_type: "Casa em steel frame",
            standard_wall_height_meters: null,
            expected_floors: null,
          },
          walls: [],
          openings: [],
          missing_information: ["Medidas confirmadas das paredes", "Aberturas e altura de pe direito"],
          warnings: ["Provider mock ativo: nenhuma medida foi extraida de um documento real."],
          confidence: 0,
        });
      }

      if (input.task === "extract-supplier-quote") {
        return JSON.stringify({
          supplier: {
            name: "Fornecedor de desenvolvimento",
            tax_id: null,
            contact_name: null,
            contact_phone: null,
            contact_email: null,
          },
          quote: {
            number: "MOCK-001",
            issued_on: null,
            valid_until: null,
            expected_billing_on: null,
            payment_terms: "A confirmar",
            subtotal: 0,
            discount: 0,
            freight: 0,
            taxes: 0,
            total: 0,
            currency: "BRL",
          },
          items: [],
          summary: "Cotacao simulada para desenvolvimento. Nenhum preco pode ser usado no catalogo sem revisao.",
          warnings: ["Provider mock ativo: os valores nao vieram de uma cotacao real."],
          confidence: 0,
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
