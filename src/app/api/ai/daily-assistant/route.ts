import { NextResponse } from "next/server";
import { z } from "zod";
import { parseAIJsonResponse } from "@/lib/ai/parse-ai-json";
import { AIConfigurationError, getConfiguredAIProvider } from "@/lib/ai/provider";
import { AIProviderRequestError } from "@/lib/ai/providers/shared";
import { dailyAssistantRequestSchema, dailyAssistantResponseSchema } from "@/lib/validations/daily-assistant";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Sessao invalida. Faca login novamente." }, { status: 401 });
  }

  const parsedRequest = dailyAssistantRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error.issues[0]?.message ?? "Dados invalidos para orientar o dia." }, { status: 400 });
  }

  try {
    const provider = getConfiguredAIProvider();
    const raw = await provider.generate({ task: "daily-assistant", prompt: buildPrompt(parsedRequest.data), images: [] });
    const parsed = dailyAssistantResponseSchema.parse(parseAIJsonResponse(raw));
    const actionIds = new Set(parsedRequest.data.actions.map((action) => action.id));
    const suggestedActionId = parsed.suggested_action_id && actionIds.has(parsed.suggested_action_id) ? parsed.suggested_action_id : null;

    return NextResponse.json({ ...parsed, suggested_action_id: suggestedActionId, provider: provider.name });
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof AIProviderRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "A IA retornou uma orientacao em formato invalido. Tente novamente." }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "Nao foi possivel preparar a orientacao.";
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

function buildPrompt(input: z.infer<typeof dailyAssistantRequestSchema>) {
  return `
Voce e Nova Forma IA, assistente comercial da Nova Forma Steel Frame.
Organize a proxima decisao comercial usando somente os dados estruturados fornecidos.
Nao invente fatos sobre clientes, prazo, valor, localizacao, visitas ou contatos.
Nao execute acoes e nao solicite dados sensiveis. A pessoa usuaria confirma qualquer alteracao ou mensagem externa.

Modo solicitado: ${input.mode}
Usuario: ${input.profile_name || "equipe comercial"}
Acoes reais do CRM: ${JSON.stringify(input.actions)}

Responda de forma objetiva, acolhedora e sem culpabilizar atrasos. Use no maximo duas frases curtas.
Se houver informacao comercial ausente, liste no maximo tres campos em missing_information e proponha somente uma pergunta curta em suggested_question. Se nao faltar nada relevante, use [] e null.
suggested_action_id so pode ser o id exato de uma acao fornecida ou null.

Retorne exclusivamente JSON valido, sem markdown:
{"message":"","suggested_action_id":null,"missing_information":[],"suggested_question":null}
`.trim();
}
