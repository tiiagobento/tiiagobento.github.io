import { NextResponse } from "next/server";
import { z } from "zod";

import { parseAIJsonResponse } from "@/lib/ai/parse-ai-json";
import { AIConfigurationError, getConfiguredAIProvider } from "@/lib/ai/provider";
import type { AIImageInput } from "@/lib/ai/provider-types";
import { AIProviderRequestError } from "@/lib/ai/providers/shared";
import {
  buildSteelFrameSupplierQuoteAnalysisPrompt,
  steelFrameCatalogBucket,
  steelFrameSupplierQuoteAnalysisSchema,
} from "@/lib/steel-frame/catalog";
import { authorizeServerPermission } from "@/lib/supabase/route-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const maxInlineDocumentBytes = 15 * 1024 * 1024;

const requestSchema = z.object({
  sourceId: z.string().uuid(),
  sourceDocumentId: z.string().uuid(),
  context: z.string().trim().max(5_000).optional().default(""),
});

type CatalogSourceDocument = {
  id: string;
  source_id: string;
  original_file_name: string;
  storage_path: string;
  mime_type: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  file_size_bytes: number;
};

export async function POST(request: Request) {
  const authorization = await authorizeServerPermission("estimates.catalog.manage");
  if (authorization.status === "unauthenticated") {
    return NextResponse.json({ error: "Sessao invalida. Faca login novamente." }, { status: 401 });
  }
  if (authorization.status === "forbidden") {
    return NextResponse.json({ error: "Sua conta nao possui permissao para analisar cotacoes de fornecedor." }, { status: 403 });
  }

  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error.issues[0]?.message ?? "Dados invalidos para analise." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  try {
    const [sourceResult, documentResult] = await Promise.all([
      supabase
        .from("steel_frame_technical_sources")
        .select("id, source_type")
        .eq("id", parsedRequest.data.sourceId)
        .eq("source_type", "supplier_quote")
        .maybeSingle(),
      supabase
        .from("steel_frame_technical_source_documents")
        .select("id, source_id, original_file_name, storage_path, mime_type, file_size_bytes")
        .eq("id", parsedRequest.data.sourceDocumentId)
        .eq("source_id", parsedRequest.data.sourceId)
        .maybeSingle(),
    ]);

    if (sourceResult.error) throw sourceResult.error;
    if (documentResult.error) throw documentResult.error;
    if (!sourceResult.data || !documentResult.data) {
      return NextResponse.json({ error: "A fonte ou o documento privado da cotacao nao esta disponivel." }, { status: 404 });
    }

    const document = documentResult.data as CatalogSourceDocument;
    if (Number(document.file_size_bytes) > maxInlineDocumentBytes) {
      return NextResponse.json({ error: "O documento ultrapassa 15 MB para analise em uma unica solicitacao. Envie uma versao menor." }, { status: 400 });
    }

    const provider = getConfiguredAIProvider();
    if (provider.name !== "gemini" && provider.name !== "mock") {
      return NextResponse.json({ error: "O provider atual nao suporta analise de imagem ou PDF de cotacao. Use Gemini para revisar este documento." }, { status: 400 });
    }
    if (!provider.supportsImages) {
      return NextResponse.json({ error: "O provider atual nao suporta analise de imagem ou PDF de cotacao. Use Gemini para revisar este documento." }, { status: 400 });
    }

    const { data, error } = await supabase.storage.from(steelFrameCatalogBucket).download(document.storage_path);
    if (error || !data) throw error ?? new Error("Nao foi possivel ler o documento privado da cotacao.");

    const media: AIImageInput = {
      mimeType: document.mime_type,
      data: Buffer.from(await data.arrayBuffer()).toString("base64"),
    };
    const raw = await provider.generate({
      task: "extract-supplier-quote",
      prompt: buildSteelFrameSupplierQuoteAnalysisPrompt({
        documentName: document.original_file_name,
        additionalContext: parsedRequest.data.context,
      }),
      images: [media],
    });
    const parsed = steelFrameSupplierQuoteAnalysisSchema.parse(parseAIJsonResponse(raw));
    const analysis = parsed.items.length
      ? parsed
      : {
        ...parsed,
        warnings: [...parsed.warnings, "Nenhum item completo foi identificado. Revise o documento e preencha os itens manualmente antes de salvar."],
      };

    return NextResponse.json({ analysis, provider: provider.name });
  } catch (error) {
    return handleAIError(error);
  }
}

function handleAIError(error: unknown) {
  if (error instanceof AIConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof AIProviderRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "A IA retornou uma cotacao incompleta ou invalida. Revise o documento e tente novamente." }, { status: 502 });
  }
  return NextResponse.json({ error: "Nao foi possivel concluir a analise da cotacao. Tente novamente." }, { status: 502 });
}
