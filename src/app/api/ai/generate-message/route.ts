import { NextResponse } from "next/server";
import { z } from "zod";
import { parseAIJsonResponse } from "@/lib/ai/parse-ai-json";
import { AIConfigurationError, getConfiguredAIProvider } from "@/lib/ai/provider";
import { AIProviderRequestError } from "@/lib/ai/providers/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const requestSchema = z.object({
  objective: z.string().min(3).max(2_000),
  context: z.string().max(10_000).optional().default(""),
  tone: z.enum(["profissional", "cordial", "direto"]).optional().default("profissional"),
  lead: z.record(z.string(), z.unknown()).optional().default({}),
});

const responseSchema = z.object({
  message: z.string().min(1).max(5_000),
  warnings: z.array(z.string()).optional().default([]),
});

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Sessão inválida. Faça login novamente." }, { status: 401 });
  }

  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error.issues[0]?.message ?? "Dados inválidos para gerar mensagem." }, { status: 400 });
  }

  try {
    const provider = getConfiguredAIProvider();
    const prompt = buildMessagePrompt(parsedRequest.data);
    const raw = await provider.generate({ task: "generate-message", prompt, images: [] });
    const result = responseSchema.parse(parseAIJsonResponse(raw));
    return NextResponse.json({ ...result, provider: provider.name });
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof AIProviderRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "A IA retornou uma mensagem em formato inválido. Tente novamente." }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "Não foi possível gerar a mensagem.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function isAuthenticated() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return Boolean(user);
  } catch {
    return false;
  }
}

function buildMessagePrompt(input: z.infer<typeof requestSchema>) {
  return `
Você é um assistente comercial da Nova Forma Steel Frame.
Crie uma mensagem curta para WhatsApp, em português do Brasil, com tom ${input.tone}.
Não invente dados. Use somente o contexto e os dados do lead fornecidos.
Objetivo: ${input.objective}
Contexto adicional: ${input.context || "Não informado"}
Dados do lead: ${JSON.stringify(input.lead)}

Retorne exclusivamente JSON válido, sem markdown:
{"message":"texto da mensagem","warnings":[]}
`.trim();
}
