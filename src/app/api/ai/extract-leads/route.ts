import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPuterLeadPrompt } from "@/lib/ai/puter-lead-prompt";
import { parseAIJsonResponse } from "@/lib/ai/parse-ai-json";
import { AIConfigurationError, getConfiguredAIProvider } from "@/lib/ai/provider";
import { AIProviderRequestError } from "@/lib/ai/providers/shared";
import { AI_ACCEPTED_IMAGE_TYPES, AI_IMAGE_MAX_BYTES, AI_IMAGE_MAX_COUNT, dataUrlToGeminiInlineData, estimateBase64Bytes, normalizeBase64 } from "@/lib/ai/image-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiLeadAnalysisSchema } from "@/lib/validations/ai-lead-draft";
import type { AIImageInput } from "@/lib/ai/provider-types";

export const runtime = "nodejs";

const imagePayloadSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    try {
      return dataUrlToGeminiInlineData(value);
    } catch {
      return value;
    }
  }
  return value;
}, z.object({
  mimeType: z.string().transform((value) => value.toLowerCase()),
  data: z.string().min(1).transform(normalizeBase64),
}).superRefine((value, ctx) => {
  if (!AI_ACCEPTED_IMAGE_TYPES.has(value.mimeType)) {
    ctx.addIssue({ code: "custom", message: "Envie apenas imagens PNG, JPG, JPEG ou WEBP." });
  }
  if (estimateBase64Bytes(value.data) > AI_IMAGE_MAX_BYTES) {
    ctx.addIssue({ code: "custom", message: "Cada imagem pode ter no maximo 5 MB." });
  }
}));

const requestSchema = z.object({
  conversation: z.string().max(20_000).optional(),
  text: z.string().max(20_000).optional(),
  source: z.string().min(1).max(100),
  images: z.array(imagePayloadSchema).max(AI_IMAGE_MAX_COUNT, `Envie no maximo ${AI_IMAGE_MAX_COUNT} imagens.`).default([]),
}).transform((value) => ({
  conversation: value.conversation ?? value.text ?? "",
  source: value.source,
  images: value.images,
})).refine((value) => value.conversation.trim().length > 0 || value.images.length > 0, {
  message: "Envie uma imagem ou cole um texto antes de analisar.",
});

export async function POST(request: Request) {
  const unauthorized = await requireAuthenticatedUser();
  if (unauthorized) return unauthorized;

  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error.issues[0]?.message ?? "Dados inválidos para análise." }, { status: 400 });
  }

  try {
    const provider = getConfiguredAIProvider();
    const images = parsedRequest.data.images as AIImageInput[];
    const prompt = buildPuterLeadPrompt({
      conversation: parsedRequest.data.conversation,
      source: parsedRequest.data.source,
      imageCount: images.length,
    });
    const raw = await provider.generate({
      task: "extract-leads",
      prompt,
      images,
    });
    const result = aiLeadAnalysisSchema.parse(parseAIJsonResponse(raw));
    return NextResponse.json({ ...result, provider: provider.name });
  } catch (error) {
    return handleAIError(error);
  }
}

async function requireAuthenticatedUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return null;
  } catch {
    // Return a generic authentication error without leaking configuration.
  }
  return NextResponse.json({ error: "Sessão inválida. Faça login novamente." }, { status: 401 });
}

function handleAIError(error: unknown) {
  if (error instanceof AIConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof AIProviderRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "A IA retornou dados incompletos ou inválidos. Tente novamente." }, { status: 502 });
  }
  const message = error instanceof Error ? error.message : "Não foi possível concluir a análise.";
  return NextResponse.json({ error: message }, { status: 502 });
}
