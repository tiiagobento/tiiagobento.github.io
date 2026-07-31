import { NextResponse } from "next/server";
import { z } from "zod";
import { parseAIJsonResponse } from "@/lib/ai/parse-ai-json";
import { AIConfigurationError, getConfiguredAIProvider } from "@/lib/ai/provider";
import type { AIImageInput } from "@/lib/ai/provider-types";
import { AIProviderRequestError } from "@/lib/ai/providers/shared";
import { buildSteelFrameDocumentAnalysisPrompt, steelFrameDocumentAnalysisSchema } from "@/lib/steel-frame/ai";
import { steelFrameDocumentsBucket } from "@/lib/steel-frame/documents";
import { authorizeServerPermission } from "@/lib/supabase/route-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const maxInlineDocumentBytes = 15 * 1024 * 1024;

const requestSchema = z.object({
  estimateId: z.string().uuid(),
  documentIds: z.array(z.string().uuid()).min(1).max(3).refine((ids) => new Set(ids).size === ids.length, {
    message: "Selecione documentos diferentes para a analise.",
  }),
  context: z.string().trim().max(5_000).optional().default(""),
});

type StoredDocument = {
  id: string;
  original_file_name: string;
  storage_path: string;
  mime_type: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  file_size_bytes: number;
};

export async function POST(request: Request) {
  const authorization = await authorizeServerPermission("ai.import");
  if (authorization.status === "unauthenticated") {
    return NextResponse.json({ error: "Sessao invalida. Faca login novamente." }, { status: 401 });
  }
  if (authorization.status === "forbidden") {
    return NextResponse.json({ error: "Sua conta nao possui permissao para analisar documentos com IA." }, { status: 403 });
  }

  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error.issues[0]?.message ?? "Dados invalidos para analise." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  let jobId: string | null = null;

  try {
    const { data: documents, error: documentsError } = await supabase
      .from("steel_frame_documents")
      .select("id, original_file_name, storage_path, mime_type, file_size_bytes")
      .eq("estimate_id", parsedRequest.data.estimateId)
      .in("id", parsedRequest.data.documentIds);
    if (documentsError) throw documentsError;

    const orderedDocuments = parsedRequest.data.documentIds
      .map((id) => (documents ?? []).find((document) => document.id === id))
      .filter((document): document is StoredDocument => Boolean(document));
    if (orderedDocuments.length !== parsedRequest.data.documentIds.length) {
      return NextResponse.json({ error: "Um ou mais documentos nao estao disponiveis para este orcamento." }, { status: 404 });
    }

    const totalBytes = orderedDocuments.reduce((total, document) => total + Number(document.file_size_bytes), 0);
    if (totalBytes > maxInlineDocumentBytes) {
      return NextResponse.json({ error: "Os documentos selecionados ultrapassam 15 MB para analise em uma unica solicitacao. Selecione menos arquivos." }, { status: 400 });
    }

    const provider = getConfiguredAIProvider();
    if (provider.name !== "gemini" && provider.name !== "mock") {
      return NextResponse.json({ error: "A analise de planta, croqui e PDF requer Gemini. Configure AI_PROVIDER=gemini ou use o provider mock apenas em desenvolvimento." }, { status: 400 });
    }
    if (!provider.supportsImages) {
      return NextResponse.json({ error: "O provider atual nao suporta analise de documentos. Use Gemini para analisar plantas, fotos e PDFs." }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabase
      .from("steel_frame_ai_analysis_jobs")
      .insert({
        estimate_id: parsedRequest.data.estimateId,
        document_id: orderedDocuments[0].id,
        requested_by: authorization.userId,
        provider: provider.name,
        model: provider.name === "gemini" ? process.env.GEMINI_MODEL?.trim() || null : null,
        status: "processing",
        prompt_version: "steel-frame-document-v1",
        request_metadata: {
          document_ids: parsedRequest.data.documentIds,
          total_bytes: totalBytes,
          has_additional_context: Boolean(parsedRequest.data.context),
        },
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (jobError) throw jobError;
    jobId = job.id;

    const media = await Promise.all(orderedDocuments.map(async (document) => {
      const { data, error } = await supabase.storage.from(steelFrameDocumentsBucket).download(document.storage_path);
      if (error || !data) throw error ?? new Error("Nao foi possivel ler um documento privado.");
      return {
        mimeType: document.mime_type,
        data: Buffer.from(await data.arrayBuffer()).toString("base64"),
      } satisfies AIImageInput;
    }));

    const prompt = buildSteelFrameDocumentAnalysisPrompt({
      documentNames: orderedDocuments.map((document) => document.original_file_name),
      additionalContext: parsedRequest.data.context,
    });
    const raw = await provider.generate({ task: "extract-estimate", prompt, images: media });
    const analysis = normalizeEvidenceDocumentIndexes(
      steelFrameDocumentAnalysisSchema.parse(parseAIJsonResponse(raw)),
      orderedDocuments.length,
    );

    const primaryEvidence = analysis.walls[0]?.evidence ?? analysis.openings[0]?.evidence ?? null;
    const sourceDocument = primaryEvidence?.document_index
      ? orderedDocuments[primaryEvidence.document_index - 1]
      : orderedDocuments[0];
    const { data: extraction, error: extractionError } = await supabase
      .from("steel_frame_ai_extractions")
      .insert({
        job_id: job.id,
        estimate_id: parsedRequest.data.estimateId,
        field_name: "document_analysis",
        entity_type: "estimate",
        value: analysis,
        confidence: analysis.confidence,
        confirmation_status: "needs_confirmation",
        source_document_id: sourceDocument?.id ?? null,
        page_number: primaryEvidence?.page_number ?? null,
        source_text: primaryEvidence?.source_text ?? analysis.summary.slice(0, 1000),
        bounding_box: primaryEvidence?.bounding_box ?? null,
      })
      .select("id")
      .single();
    if (extractionError) throw extractionError;

    if (analysis.missing_information.length) {
      const { error: questionsError } = await supabase.from("steel_frame_ai_questions").insert(
        analysis.missing_information.map((question) => ({
          estimate_id: parsedRequest.data.estimateId,
          job_id: job.id,
          field_name: "document_analysis",
          question,
          created_by: authorization.userId,
        })),
      );
      if (questionsError) throw questionsError;
    }

    const { error: finishError } = await supabase
      .from("steel_frame_ai_analysis_jobs")
      .update({
        status: "needs_review",
        response_metadata: { extraction_count: 1, missing_information_count: analysis.missing_information.length },
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (finishError) throw finishError;

    return NextResponse.json({ jobId: job.id, extractionId: extraction.id, analysis, provider: provider.name });
  } catch (error) {
    if (jobId) {
      await supabase
        .from("steel_frame_ai_analysis_jobs")
        .update({ status: "failed", error_message: getSafeErrorMessage(error), completed_at: new Date().toISOString() })
        .eq("id", jobId);
    }
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
    return NextResponse.json({ error: "A IA retornou uma analise incompleta ou invalida. Tente novamente e revise o documento." }, { status: 502 });
  }
  return NextResponse.json({ error: "Nao foi possivel concluir a analise do documento. Tente novamente." }, { status: 502 });
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof AIProviderRequestError || error instanceof AIConfigurationError) return error.message.slice(0, 500);
  if (error instanceof z.ZodError) return "Resposta da IA nao passou pela validacao.";
  return "Falha ao analisar documento.";
}

function normalizeEvidenceDocumentIndexes(
  analysis: z.infer<typeof steelFrameDocumentAnalysisSchema>,
  documentCount: number,
) {
  let invalidReferenceFound = false;
  const normalizeEvidence = <T extends { evidence: { document_index: number | null } }>(item: T) => {
    if (item.evidence.document_index !== null && item.evidence.document_index > documentCount) {
      invalidReferenceFound = true;
      return { ...item, evidence: { ...item.evidence, document_index: null } };
    }
    return item;
  };

  const normalized = {
    ...analysis,
    walls: analysis.walls.map(normalizeEvidence),
    openings: analysis.openings.map(normalizeEvidence),
  };
  if (!invalidReferenceFound) return normalized;

  return {
    ...normalized,
    warnings: [...normalized.warnings, "A IA referenciou um documento fora da selecao; a evidencia foi marcada para revisao."],
  };
}
