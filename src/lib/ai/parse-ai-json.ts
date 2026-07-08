import { aiLeadAnalysisSchema, aiLeadDraftSchema, type AILeadAnalysisResult, type AILeadDraft } from "@/lib/validations/ai-lead-draft";

type PuterContentPart = {
  text?: unknown;
  content?: unknown;
};

type PuterResponseLike = {
  text?: unknown;
  content?: unknown;
  message?: {
    content?: unknown;
  };
};

export function parseAILeadJson(rawResponse: unknown): AILeadDraft {
  const text = extractResponseText(rawResponse);
  const json = parseAIJsonResponse(text);
  return aiLeadDraftSchema.parse(json);
}

export function parseAILeadAnalysisResponse(rawResponse: unknown): AILeadAnalysisResult {
  const text = extractResponseText(rawResponse);
  const json = parseAIJsonResponse(text);
  return aiLeadAnalysisSchema.parse(json);
}

export function extractResponseText(rawResponse: unknown): string {
  if (typeof rawResponse === "string") return rawResponse;
  if (!rawResponse || typeof rawResponse !== "object") return String(rawResponse ?? "");

  const response = rawResponse as PuterResponseLike;
  const candidates = [response.text, response.content, response.message?.content];

  for (const candidate of candidates) {
    const text = stringifyContent(candidate);
    if (text.trim()) return text;
  }

  return JSON.stringify(rawResponse);
}

function stringifyContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const typedPart = part as PuterContentPart;
          return stringifyContent(typedPart.text ?? typedPart.content);
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content && typeof content === "object") return JSON.stringify(content);
  return "";
}

export function parseAIJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        // Continue to balanced object extraction.
      }
    }

    const objectBlock = extractBalancedJsonObject(trimmed);
    if (objectBlock) return JSON.parse(objectBlock);
    throw new Error("A IA respondeu em um formato invalido. Tente novamente.");
  }
}

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') inString = true;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
}
