// @vitest-environment node

import { describe, expect, it } from "vitest";
import { templateCategories } from "@/lib/constants";
import { applyTemplate, buildWhatsAppUrl } from "@/lib/business";
import { defaultMessageTemplates, getTemplatesWithDefaults, isDefaultMessageTemplate } from "@/lib/default-message-templates";
import { leadFixture, templateFixture } from "@/test/fixtures";

describe("default message templates", () => {
  it("provides at least three default templates per category", () => {
    for (const category of templateCategories) {
      expect(defaultMessageTemplates.filter((template) => template.category === category)).toHaveLength(3);
    }
  });

  it("appears when the user has no saved templates", () => {
    const templates = getTemplatesWithDefaults([]);

    expect(templates.length).toBe(defaultMessageTemplates.length);
    expect(templates.every(isDefaultMessageTemplate)).toBe(true);
  });

  it("mixes user templates with the default library without duplicating same title and category", () => {
    const userTemplate = templateFixture({ title: defaultMessageTemplates[0].title, category: defaultMessageTemplates[0].category, content: "Minha versao" });
    const templates = getTemplatesWithDefaults([userTemplate]);

    expect(templates[0]).toBe(userTemplate);
    expect(templates.filter((template) => template.title === userTemplate.title && template.category === userTemplate.category)).toHaveLength(1);
  });

  it("supports category filter, text search, variable replacement and WhatsApp URL", () => {
    const lead = leadFixture({ name: "Solange", city: "Biguacu", neighborhood: "Deltaville", project_type: "Casa em steel frame" });
    const categoryMatches = defaultMessageTemplates.filter((template) => template.category === "Primeiro contato");
    const searchMatches = defaultMessageTemplates.filter((template) => `${template.title} ${template.content}`.toLowerCase().includes("terreno"));
    const message = applyTemplate(categoryMatches[0].content, lead);

    expect(categoryMatches).toHaveLength(3);
    expect(searchMatches.length).toBeGreaterThan(0);
    expect(message).toContain("Solange");
    expect(message).toContain("Nova Forma Steel Frame");
    expect(buildWhatsAppUrl(lead.phone, message)).toContain("https://wa.me/");
  });
});
