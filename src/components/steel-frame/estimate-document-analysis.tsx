"use client";

import * as React from "react";
import { Bot, CheckCircle2, CircleAlert, Eye, FileSearch, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { steelFrameDocumentAnalysisSchema, type SteelFrameDocumentAnalysis } from "@/lib/steel-frame/ai";
import {
  addSteelFrameAICorrection,
  addSteelFrameOpening,
  addSteelFrameWall,
  getSteelFrameErrorMessage,
} from "@/lib/steel-frame/data";
import { steelFrameOpeningSchema, steelFrameWallSegmentSchema } from "@/lib/steel-frame/schemas";
import type { SteelFrameDocumentRecord, SteelFrameWallSegmentRecord } from "@/lib/steel-frame/types";

type ReviewWall = {
  id: string;
  include: boolean;
  label: string;
  length: string;
  height: string;
  quantity: string;
  original: SteelFrameDocumentAnalysis["walls"][number];
};

type ReviewOpening = {
  id: string;
  include: boolean;
  label: string;
  type: SteelFrameDocumentAnalysis["openings"][number]["opening_type"];
  width: string;
  height: string;
  quantity: string;
  wallReference: string;
  original: SteelFrameDocumentAnalysis["openings"][number];
};

function toEditableNumber(value: number | null) {
  return value === null ? "" : String(value);
}

function parseNumber(value: string) {
  return Number(value.replace(",", "."));
}

function stringifyComparable(value: unknown) {
  return JSON.stringify(value);
}

function normalizeLabel(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ") ?? "";
}

function needsWallAttention(wall: ReviewWall) {
  return wall.original.confidence < 0.8 || !wall.length || !wall.height || !wall.quantity;
}

function needsOpeningAttention(opening: ReviewOpening) {
  return opening.original.confidence < 0.8 || !opening.width || !opening.height || !opening.quantity || opening.wallReference === "unlinked";
}

export function EstimateDocumentAnalysis({
  estimateId,
  documents,
  wallCount,
  openingCount,
  existingWalls = [],
  onGeometryChanged,
}: {
  estimateId: string;
  documents: SteelFrameDocumentRecord[];
  wallCount: number;
  openingCount: number;
  existingWalls?: SteelFrameWallSegmentRecord[];
  onGeometryChanged: () => Promise<void> | void;
}) {
  const [selectedDocumentIds, setSelectedDocumentIds] = React.useState<string[]>([]);
  const [context, setContext] = React.useState("");
  const [analysis, setAnalysis] = React.useState<SteelFrameDocumentAnalysis | null>(null);
  const [extractionId, setExtractionId] = React.useState<string | null>(null);
  const [reviewWalls, setReviewWalls] = React.useState<ReviewWall[]>([]);
  const [reviewOpenings, setReviewOpenings] = React.useState<ReviewOpening[]>([]);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [attentionOnly, setAttentionOnly] = React.useState(true);

  const selectableDocuments = documents.filter((document) => document.metadata?.upload_state !== "pending");

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((current) => {
      if (current.includes(documentId)) return current.filter((id) => id !== documentId);
      if (current.length >= 3) {
        toast.error("Selecione no maximo 3 documentos por analise.");
        return current;
      }
      return [...current, documentId];
    });
  }

  async function analyzeDocuments() {
    if (!selectedDocumentIds.length) {
      toast.error("Selecione pelo menos um documento para analisar.");
      return;
    }

    setAnalyzing(true);
    try {
      const response = await fetch("/api/ai/extract-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId, documentIds: selectedDocumentIds, context }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Nao foi possivel analisar os documentos.";
        throw new Error(message);
      }

      const parsedPayload = payload && typeof payload === "object" && "analysis" in payload
        ? steelFrameDocumentAnalysisSchema.safeParse(payload.analysis)
        : null;
      if (!parsedPayload?.success) throw new Error("A IA retornou uma analise incompleta. Revise os documentos e tente novamente.");

      const responseRecord = payload as Record<string, unknown>;
      const returnedExtractionId = typeof responseRecord.extractionId === "string"
        ? responseRecord.extractionId
        : null;
      const nextReviewWalls = parsedPayload.data.walls.map((wall, index) => ({
        id: `wall-${index}`,
        include: wall.length_meters !== null && wall.height_meters !== null && wall.quantity !== null,
        label: wall.label,
        length: toEditableNumber(wall.length_meters),
        height: toEditableNumber(wall.height_meters),
        quantity: toEditableNumber(wall.quantity),
        original: wall,
      }));
      setAnalysis(parsedPayload.data);
      setExtractionId(returnedExtractionId);
      setReviewWalls(nextReviewWalls);
      setReviewOpenings(parsedPayload.data.openings.map((opening, index) => ({
        id: `opening-${index}`,
        include: opening.width_meters !== null && opening.height_meters !== null && opening.quantity !== null,
        label: opening.label,
        type: opening.opening_type,
        width: toEditableNumber(opening.width_meters),
        height: toEditableNumber(opening.height_meters),
        quantity: toEditableNumber(opening.quantity),
        wallReference: (() => {
          const wallLabel = normalizeLabel(opening.wall_label);
          const reviewWall = nextReviewWalls.find((wall) => normalizeLabel(wall.label) === wallLabel);
          if (reviewWall) return `review:${reviewWall.id}`;
          const existingWall = existingWalls.find((wall) => normalizeLabel(wall.label) === wallLabel);
          return existingWall ? `existing:${existingWall.id}` : "unlinked";
        })(),
        original: opening,
      })));
      toast.success("Rascunho da IA pronto para revisao.");
    } catch (analysisError) {
      toast.error(getSteelFrameErrorMessage(analysisError));
    } finally {
      setAnalyzing(false);
    }
  }

  async function applyReviewedGeometry() {
    const selectedWalls = reviewWalls.filter((wall) => wall.include);
    const selectedOpenings = reviewOpenings.filter((opening) => opening.include);
    if (!selectedWalls.length && !selectedOpenings.length) {
      toast.error("Selecione ao menos um item completo para adicionar a geometria.");
      return;
    }

    const parsedWalls = selectedWalls.map((wall) => ({
      review: wall,
      result: steelFrameWallSegmentSchema.safeParse({
        label: wall.label,
        lengthMeters: parseNumber(wall.length),
        heightMeters: parseNumber(wall.height),
        quantity: parseNumber(wall.quantity),
        confirmationStatus: "confirmed",
      }),
    }));
    const parsedOpenings = selectedOpenings.map((opening) => ({
      review: opening,
      result: steelFrameOpeningSchema.safeParse({
        label: opening.label,
        openingType: opening.type,
        widthMeters: parseNumber(opening.width),
        heightMeters: parseNumber(opening.height),
        quantity: parseNumber(opening.quantity),
        wallSegmentId: opening.wallReference.startsWith("existing:")
          ? opening.wallReference.slice("existing:".length)
          : null,
        subtractFromWallArea: true,
        confirmationStatus: "confirmed",
      }),
    }));
    const invalid = [...parsedWalls, ...parsedOpenings].find((entry) => !entry.result.success);
    if (invalid && !invalid.result.success) {
      toast.error(invalid.result.error.issues[0]?.message ?? "Revise os campos selecionados.");
      return;
    }
    const unavailableReviewWall = selectedOpenings.find((opening) => {
      if (!opening.wallReference.startsWith("review:")) return false;
      const reviewId = opening.wallReference.slice("review:".length);
      return !selectedWalls.some((wall) => wall.id === reviewId);
    });
    if (unavailableReviewWall) {
      toast.error(`Inclua a parede vinculada a abertura "${unavailableReviewWall.label}" ou selecione outra parede.`);
      return;
    }

    setApplying(true);
    let auditWarning = false;
    try {
      let nextWallOrder = wallCount;
      const createdWallIds = new Map<string, string>();
      for (const entry of parsedWalls) {
        if (!entry.result.success) continue;
        const reviewValue = {
          label: entry.review.label,
          length_meters: parseNumber(entry.review.length),
          height_meters: parseNumber(entry.review.height),
          quantity: parseNumber(entry.review.quantity),
        };
        const savedWall = await addSteelFrameWall(estimateId, {
          ...entry.result.data,
          sourceDescription: "Confirmado a partir de rascunho de IA documental.",
          sourceData: {
            ai_extraction_id: extractionId,
            ai_confidence: entry.review.original.confidence,
            ai_evidence: entry.review.original.evidence,
          },
        }, nextWallOrder++);
        createdWallIds.set(entry.review.id, savedWall.id);
        if (extractionId && stringifyComparable(reviewValue) !== stringifyComparable({
          label: entry.review.original.label,
          length_meters: entry.review.original.length_meters,
          height_meters: entry.review.original.height_meters,
          quantity: entry.review.original.quantity,
        })) {
          try {
            await addSteelFrameAICorrection({
              estimateId,
              extractionId,
              fieldName: `wall.${entry.review.id}`,
              previousValue: entry.review.original,
              correctedValue: reviewValue,
            });
          } catch {
            auditWarning = true;
          }
        }
      }

      let nextOpeningOrder = openingCount;
      for (const entry of parsedOpenings) {
        if (!entry.result.success) continue;
        const reviewedWallId = entry.review.wallReference.startsWith("review:")
          ? createdWallIds.get(entry.review.wallReference.slice("review:".length)) ?? null
          : null;
        const existingWallId = entry.review.wallReference.startsWith("existing:")
          ? entry.review.wallReference.slice("existing:".length)
          : null;
        const reviewValue = {
          label: entry.review.label,
          opening_type: entry.review.type,
          width_meters: parseNumber(entry.review.width),
          height_meters: parseNumber(entry.review.height),
          quantity: parseNumber(entry.review.quantity),
          wall_reference: entry.review.wallReference,
        };
        await addSteelFrameOpening(estimateId, {
          ...entry.result.data,
          wallSegmentId: reviewedWallId ?? existingWallId,
          sourceDescription: "Confirmado a partir de rascunho de IA documental.",
          sourceData: {
            ai_extraction_id: extractionId,
            ai_confidence: entry.review.original.confidence,
            ai_evidence: entry.review.original.evidence,
            ai_wall_label: entry.review.original.wall_label,
          },
        }, nextOpeningOrder++);
        if (extractionId && stringifyComparable(reviewValue) !== stringifyComparable({
          label: entry.review.original.label,
          opening_type: entry.review.original.opening_type,
          width_meters: entry.review.original.width_meters,
          height_meters: entry.review.original.height_meters,
          quantity: entry.review.original.quantity,
          wall_reference: entry.review.original.wall_label,
        })) {
          try {
            await addSteelFrameAICorrection({
              estimateId,
              extractionId,
              fieldName: `opening.${entry.review.id}`,
              previousValue: entry.review.original,
              correctedValue: reviewValue,
            });
          } catch {
            auditWarning = true;
          }
        }
      }

      setReviewWalls((current) => current.map((wall) => ({ ...wall, include: false })));
      setReviewOpenings((current) => current.map((opening) => ({ ...opening, include: false })));
      await onGeometryChanged();
      toast.success("Itens revisados adicionados a geometria do orcamento.");
      if (auditWarning) toast.warning("Os itens foram salvos, mas uma correcao de IA nao pode ser registrada. Tente atualizar a pagina antes de continuar.");
    } catch (applyError) {
      toast.error(getSteelFrameErrorMessage(applyError));
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-primary"><Bot className="size-4" /> Rascunho tecnico com IA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Selecione ate tres plantas, croquis, fotos ou PDFs. A IA sugere dados e evidencia; nada entra no orcamento sem sua revisao.</p>
        {selectableDocuments.length ? <div className="grid gap-2 md:grid-cols-2">{selectableDocuments.map((document) => <label key={document.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5 text-sm transition hover:border-primary/30"><input type="checkbox" className="mt-0.5" checked={selectedDocumentIds.includes(document.id)} onChange={() => toggleDocument(document.id)} disabled={analyzing || applying} /><span className="min-w-0"><span className="block truncate font-medium text-foreground">{document.original_file_name}</span><span className="block text-xs text-muted-foreground">{document.mime_type === "application/pdf" ? "PDF" : "Imagem"}</span></span></label>)}</div> : <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Envie ao menos um documento antes de iniciar a analise.</p>}
        <div className="space-y-1.5"><Label>Contexto adicional opcional</Label><Textarea value={context} onChange={(event) => setContext(event.target.value)} maxLength={5000} placeholder="Ex: confirmar se a planta corresponde ao pavimento terreo." disabled={analyzing || applying} /></div>
        <Button type="button" className="w-full sm:w-auto" onClick={() => void analyzeDocuments()} disabled={!selectedDocumentIds.length || analyzing || applying}>{analyzing ? <Loader2 className="size-4 animate-spin" /> : <FileSearch className="size-4" />}{analyzing ? "Analisando documentos..." : "Analisar com IA"}</Button>

        {analysis ? <div className="space-y-4 border-t border-border/70 pt-4">
          <div className="rounded-xl border border-accent/25 bg-accent/[0.045] p-4"><p className="text-xs font-medium uppercase tracking-wide text-accent">Sugestao da IA · confianca {Math.round(analysis.confidence * 100)}%</p><p className="mt-2 text-sm text-foreground">{analysis.summary}</p></div>
          {analysis.missing_information.length ? <InfoList title="Informacoes para confirmar" items={analysis.missing_information} /> : null}
          {analysis.warnings.length ? <InfoList title="Alertas da analise" items={analysis.warnings} warning /> : null}
          <div className="flex flex-col gap-2 rounded-xl border bg-secondary/20 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm"><Eye className="size-4 text-primary" /><span>Revise primeiro os itens incertos, incompletos ou sem parede vinculada.</span></div><Button type="button" variant="outline" size="sm" onClick={() => setAttentionOnly((current) => !current)}>{attentionOnly ? "Mostrar todos" : "Somente o que precisa de atencao"}</Button></div>
          <ReviewWallList walls={attentionOnly ? reviewWalls.filter(needsWallAttention) : reviewWalls} onChange={setReviewWalls} />
          <ReviewOpeningList openings={attentionOnly ? reviewOpenings.filter(needsOpeningAttention) : reviewOpenings} allWalls={reviewWalls} existingWalls={existingWalls} onChange={setReviewOpenings} />
          <div className="flex flex-col gap-3 rounded-xl border bg-secondary/25 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2 text-sm text-muted-foreground"><CircleAlert className="mt-0.5 size-4 shrink-0 text-accent" /><p>Revise cada medida marcada. Itens incompletos ficam fora ate que voce confirme os dados.</p></div><Button type="button" onClick={() => void applyReviewedGeometry()} disabled={applying}>{applying ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{applying ? "Adicionando..." : "Adicionar itens revisados"}</Button></div>
        </div> : null}
      </CardContent>
    </Card>
  );
}

function ReviewWallList({ walls, onChange }: { walls: ReviewWall[]; onChange: React.Dispatch<React.SetStateAction<ReviewWall[]>> }) {
  if (!walls.length) return <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Nenhuma parede precisa de atencao neste modo de revisao.</p>;
  return <div className="space-y-3"><p className="text-sm font-medium text-foreground">Paredes sugeridas</p>{walls.map((wall) => <div key={wall.id} className="space-y-3 rounded-xl border p-3"><div className="grid gap-3 md:grid-cols-[auto_1fr_0.7fr_0.7fr_0.55fr]"><input aria-label={`Incluir parede ${wall.label}`} type="checkbox" className="mt-2 size-4" checked={wall.include} onChange={(event) => onChange((current) => current.map((item) => item.id === wall.id ? { ...item, include: event.target.checked } : item))} /><EditableField label="Trecho" value={wall.label} onChange={(value) => onChange((current) => current.map((item) => item.id === wall.id ? { ...item, label: value } : item))} /><EditableField label="Comprimento" value={wall.length} onChange={(value) => onChange((current) => current.map((item) => item.id === wall.id ? { ...item, length: value } : item))} /><EditableField label="Altura" value={wall.height} onChange={(value) => onChange((current) => current.map((item) => item.id === wall.id ? { ...item, height: value } : item))} /><EditableField label="Qtd." value={wall.quantity} onChange={(value) => onChange((current) => current.map((item) => item.id === wall.id ? { ...item, quantity: value } : item))} /></div><EvidenceSummary confidence={wall.original.confidence} evidence={wall.original.evidence} /></div>)}</div>;
}

function ReviewOpeningList({ openings, allWalls, existingWalls, onChange }: { openings: ReviewOpening[]; allWalls: ReviewWall[]; existingWalls: SteelFrameWallSegmentRecord[]; onChange: React.Dispatch<React.SetStateAction<ReviewOpening[]>> }) {
  if (!openings.length) return <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Nenhuma abertura precisa de atencao neste modo de revisao.</p>;
  return <div className="space-y-3"><p className="text-sm font-medium text-foreground">Aberturas sugeridas</p>{openings.map((opening) => <div key={opening.id} className="space-y-3 rounded-xl border p-3"><div className="grid gap-3 md:grid-cols-[auto_1fr_0.7fr_0.7fr_0.55fr]"><input aria-label={`Incluir abertura ${opening.label}`} type="checkbox" className="mt-2 size-4" checked={opening.include} onChange={(event) => onChange((current) => current.map((item) => item.id === opening.id ? { ...item, include: event.target.checked } : item))} /><EditableField label="Abertura" value={opening.label} onChange={(value) => onChange((current) => current.map((item) => item.id === opening.id ? { ...item, label: value } : item))} /><EditableField label="Largura" value={opening.width} onChange={(value) => onChange((current) => current.map((item) => item.id === opening.id ? { ...item, width: value } : item))} /><EditableField label="Altura" value={opening.height} onChange={(value) => onChange((current) => current.map((item) => item.id === opening.id ? { ...item, height: value } : item))} /><EditableField label="Qtd." value={opening.quantity} onChange={(value) => onChange((current) => current.map((item) => item.id === opening.id ? { ...item, quantity: value } : item))} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label className="text-xs">Tipo</Label><Select value={opening.type} onValueChange={(value) => onChange((current) => current.map((item) => item.id === opening.id ? { ...item, type: value as ReviewOpening["type"] } : item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="door">Porta</SelectItem><SelectItem value="window">Janela</SelectItem><SelectItem value="garage">Portao</SelectItem><SelectItem value="opening">Vao</SelectItem><SelectItem value="other">Outro</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label className="text-xs">Parede correspondente</Label><Select value={opening.wallReference} onValueChange={(value) => onChange((current) => current.map((item) => item.id === opening.id ? { ...item, wallReference: value } : item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unlinked">A confirmar</SelectItem>{allWalls.map((wall) => <SelectItem key={wall.id} value={`review:${wall.id}`}>{wall.label} (deste rascunho)</SelectItem>)}{existingWalls.map((wall) => <SelectItem key={wall.id} value={`existing:${wall.id}`}>{wall.label} (ja salva)</SelectItem>)}</SelectContent></Select></div></div><EvidenceSummary confidence={opening.original.confidence} evidence={opening.original.evidence} /></div>)}</div>;
}

function EditableField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label><Input inputMode={label === "Trecho" || label === "Abertura" ? "text" : "decimal"} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function EvidenceSummary({ confidence, evidence }: { confidence: number; evidence: SteelFrameDocumentAnalysis["walls"][number]["evidence"] }) {
  const confidencePercent = Math.round(confidence * 100);
  return <details className="rounded-lg bg-secondary/30 px-3 py-2 text-xs"><summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground"><Badge variant={confidence >= 0.8 ? "success" : confidence >= 0.55 ? "warning" : "danger"}>{confidencePercent}%</Badge><span>Ver evidencia</span><span className="ml-auto text-muted-foreground">Doc. {evidence.document_index ?? "?"}{evidence.page_number ? `, pag. ${evidence.page_number}` : ""}</span></summary><p className="mt-2 text-muted-foreground">{evidence.source_text || "A IA nao indicou um trecho legivel. Confirme manualmente."}</p></details>;
}

function InfoList({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  return <div className={warning ? "rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4" : "rounded-xl border bg-secondary/25 p-4"}><p className="mb-2 text-sm font-medium text-foreground">{title}</p><ul className="space-y-1 text-sm text-muted-foreground">{items.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className={warning ? "mt-0.5 size-4 shrink-0 text-amber-600" : "mt-0.5 size-4 shrink-0 text-primary"} />{item}</li>)}</ul></div>;
}
