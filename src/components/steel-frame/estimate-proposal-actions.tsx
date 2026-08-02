"use client";

import { Download, FileCheck2, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigationAccess } from "@/components/app-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getSteelFrameCosting,
  getSteelFrameErrorMessage,
  markSteelFrameProposalGenerated,
  uploadSteelFrameDocument,
} from "@/lib/steel-frame/data";
import { formatSteelFrameCurrency } from "@/lib/steel-frame/costing";
import {
  buildSteelFrameProposalCode,
  buildSteelFrameProposalFilename,
  buildSteelFrameProposalMaterialList,
  buildSteelFrameProposalPricing,
  type SteelFrameProposalMaterialItem,
  type SteelFrameProposalPricing,
} from "@/lib/steel-frame/proposal";
import type { SteelFrameEstimateRecord } from "@/lib/steel-frame/types";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = 280;
const PRIMARY = [11, 37, 48] as const;
const ACCENT = [184, 120, 56] as const;
const INK = [31, 41, 55] as const;
const MUTED = [100, 116, 139] as const;

type ProposalPdfDocument = {
  addPage: () => void;
  getNumberOfPages: () => number;
  output: (type: "blob") => Blob;
  rect: (x: number, y: number, width: number, height: number, style?: string) => void;
  roundedRect: (x: number, y: number, width: number, height: number, radiusX: number, radiusY: number, style?: string | null) => void;
  save: (filename: string) => void;
  setDrawColor: (red: number, green: number, blue: number) => void;
  setFillColor: (red: number, green: number, blue: number) => void;
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (size: number) => void;
  setLineWidth: (width: number) => void;
  setPage: (page: number) => void;
  setTextColor: (red: number, green: number, blue: number) => void;
  splitTextToSize: (text: string, width: number) => string[];
  text: (text: string | string[], x: number, y: number, options?: { align?: "left" | "center" | "right" }) => void;
};

export type EstimateProposalPdfData = {
  proposalCode: string;
  generatedAt: string;
  estimateTitle: string;
  clientName: string;
  city: string | null;
  neighborhood: string | null;
  projectType: string | null;
  versionNumber: number;
  salePrice: number;
  validityDays: number;
  scope: string;
  terms: string;
  notes: string | null;
  materials: SteelFrameProposalMaterialItem[];
};

export function EstimateProposalActions({
  estimate,
  onGenerated,
}: {
  estimate: SteelFrameEstimateRecord;
  onGenerated: (estimate: SteelFrameEstimateRecord) => void;
}) {
  const { role, permissions, loading: permissionsLoading } = useNavigationAccess();
  const [pricing, setPricing] = useState<SteelFrameProposalPricing | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<SteelFrameProposalMaterialItem[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [validityDays, setValidityDays] = useState("7");
  const [scope, setScope] = useState("");
  const [terms, setTerms] = useState("");

  const canGenerate = role === "admin" || permissions.includes("*") || permissions.includes("estimates.proposals.generate");
  const eligibleStatus = ["approved", "proposal_generated", "sent"].includes(estimate.status);
  const canLoadPricing = canGenerate && eligibleStatus;

  useEffect(() => {
    let active = true;
    if (!canLoadPricing) {
      setPricing(null);
      setPricingError(null);
      setMaterials([]);
      return () => { active = false; };
    }

    setLoadingPricing(true);
    setPricingError(null);
    setMaterials([]);
    void getSteelFrameCosting(estimate.id)
      .then((snapshot) => ({
        pricing: buildSteelFrameProposalPricing(snapshot),
        materials: buildSteelFrameProposalMaterialList(snapshot.calculatedItems),
      }))
      .then((nextData) => {
        if (active) {
          setPricing(nextData.pricing);
          setMaterials(nextData.materials);
        }
      })
      .catch((error: unknown) => {
        if (active) setPricingError(getSteelFrameErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoadingPricing(false);
      });

    return () => { active = false; };
  }, [canLoadPricing, estimate.id]);

  const proposalDetails = useMemo(() => ({
    clientName: estimate.lead?.name ?? "Cliente a confirmar",
    city: estimate.city ?? estimate.lead?.city ?? null,
    neighborhood: estimate.neighborhood ?? estimate.lead?.neighborhood ?? null,
    projectType: estimate.project_type,
  }), [estimate]);

  async function generateProposal() {
    const parsedValidity = Number(validityDays);
    if (!pricing) return;
    if (!Number.isInteger(parsedValidity) || parsedValidity < 1 || parsedValidity > 365) {
      toast.error("Informe uma validade entre 1 e 365 dias.");
      return;
    }
    if (scope.trim().length < 10) {
      toast.error("Descreva o escopo comercial antes de gerar a proposta.");
      return;
    }

    setGenerating(true);
    const proposalCode = buildSteelFrameProposalCode(estimate.current_version_number);
    const fileName = buildSteelFrameProposalFilename(estimate.title, proposalCode);
    const generatedAt = new Date().toLocaleString("pt-BR");
    const proposalData: EstimateProposalPdfData = {
      proposalCode,
      generatedAt,
      estimateTitle: estimate.title,
      clientName: proposalDetails.clientName,
      city: proposalDetails.city,
      neighborhood: proposalDetails.neighborhood,
      projectType: proposalDetails.projectType,
      versionNumber: estimate.current_version_number,
      salePrice: pricing.recommendedSalePrice,
      validityDays: parsedValidity,
      scope: scope.trim(),
      terms: terms.trim(),
      notes: estimate.notes,
      materials,
    };

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ compress: true, format: "a4", orientation: "portrait", unit: "mm" });
      createEstimateProposalPdf(pdf, proposalData);
      const file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
      const document = await uploadSteelFrameDocument({
        estimateId: estimate.id,
        file,
        documentType: "proposal",
        visibility: "internal",
        metadata: {
          proposal_code: proposalCode,
          technical_version: estimate.current_version_number,
          sale_price: pricing.recommendedSalePrice,
          validity_days: parsedValidity,
          generated_at: new Date().toISOString(),
        },
      });
      const saved = await markSteelFrameProposalGenerated(estimate.id, document.id);
      pdf.save(fileName);
      onGenerated(saved);
      toast.success("Proposta PDF gerada, baixada e armazenada de forma privada.");
    } catch (error) {
      toast.error(getProposalPdfErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  if (permissionsLoading) {
    return <div className="h-36 animate-pulse rounded-xl bg-muted" aria-label="Carregando permissao de proposta" />;
  }

  if (!eligibleStatus) {
    return <Card className="border-primary/10"><CardContent className="flex gap-3 p-4 text-sm text-muted-foreground"><FileCheck2 className="mt-0.5 size-4 shrink-0 text-primary" /><p>Depois da aprovacao tecnica, este orcamento podera gerar uma proposta PDF vinculada a versao congelada.</p></CardContent></Card>;
  }

  if (!canGenerate) {
    return <Card className="border-primary/10"><CardContent className="flex gap-3 p-4 text-sm text-muted-foreground"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" /><p>Sua conta pode consultar este orcamento, mas nao possui permissao para gerar propostas comerciais.</p></CardContent></Card>;
  }

  return (
    <Card className="border-accent/30 bg-accent/[0.045]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-primary"><FileCheck2 className="size-4" /> Proposta comercial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingPricing ? <div className="h-20 animate-pulse rounded-lg bg-muted" aria-label="Calculando proposta" /> : null}
        {pricingError ? <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{pricingError}</p> : null}
        {pricing ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <ProposalMetric label="Custo direto registrado" value={formatSteelFrameCurrency(pricing.directCost)} />
              <ProposalMetric label="Valor minimo" value={formatSteelFrameCurrency(pricing.minimumSalePrice)} />
              <ProposalMetric label="Valor recomendado" value={formatSteelFrameCurrency(pricing.recommendedSalePrice)} accent />
            </div>
            {pricing.warnings.length ? <p className="text-sm text-amber-700 dark:text-amber-300">{pricing.warnings.join(" ")}</p> : null}
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <div className="space-y-1.5"><Label htmlFor="proposal-scope">Escopo comercial</Label><Textarea id="proposal-scope" value={scope} onChange={(event) => setScope(event.target.value)} maxLength={5000} placeholder="Descreva o que esta contemplado nesta proposta." disabled={generating} /></div>
              <div className="space-y-1.5"><Label htmlFor="proposal-validity">Validade (dias)</Label><Input id="proposal-validity" type="number" min={1} max={365} value={validityDays} onChange={(event) => setValidityDays(event.target.value)} disabled={generating} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="proposal-terms">Condicoes comerciais</Label><Textarea id="proposal-terms" value={terms} onChange={(event) => setTerms(event.target.value)} maxLength={5000} placeholder="Pagamento, condicoes ou informacoes a confirmar com o cliente." disabled={generating} /></div>
            <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">O PDF inclui {materials.length ? `${materials.length} materiais tecnicos sem custos unitarios, ` : "a base comercial, "}aceite e condicoes. Ele sera salvo no bucket privado e vinculado a versao tecnica {estimate.current_version_number}. Nenhuma mensagem sera enviada automaticamente.</p><Button type="button" onClick={() => void generateProposal()} disabled={generating}>{generating ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{generating ? "Gerando..." : "Gerar proposta PDF"}</Button></div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProposalMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={accent ? "rounded-lg border border-accent/30 bg-accent/10 p-3" : "rounded-lg border border-border/70 bg-background/70 p-3"}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold text-foreground">{value}</p></div>;
}

export function getProposalPdfErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Nao foi possivel gerar a proposta PDF.";
  return message.includes("oklab")
    ? "O navegador carregou uma versao antiga da tela. Atualize a pagina e tente novamente."
    : message;
}

export function createEstimateProposalPdf(pdf: ProposalPdfDocument, data: EstimateProposalPdfData) {
  let y = drawProposalHeader(pdf, data, false);
  const nextPage = () => {
    pdf.addPage();
    y = drawProposalHeader(pdf, data, true);
  };
  const ensureSpace = (height: number) => {
    if (y + height > CONTENT_BOTTOM) nextPage();
  };
  const section = (title: string) => {
    ensureSpace(12);
    pdf.setFillColor(...ACCENT);
    pdf.roundedRect(MARGIN, y, 4, 8, 1, 1, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11.5);
    pdf.setTextColor(...PRIMARY);
    pdf.text(title, MARGIN + 8, y + 5.5);
    y += 11;
  };
  const paragraph = (value: string, shaded = false) => {
    const lines = pdf.splitTextToSize(normalizeProposalValue(value), CONTENT_WIDTH - (shaded ? 8 : 0));
    let remaining = [...lines];
    while (remaining.length) {
      const lineHeight = 4.6;
      const linesOnPage = Math.max(1, Math.floor((CONTENT_BOTTOM - y - (shaded ? 7 : 0)) / lineHeight));
      const chunk = remaining.splice(0, linesOnPage);
      const height = chunk.length * lineHeight + (shaded ? 7 : 0);
      ensureSpace(height);
      if (shaded) {
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 2, 2, "FD");
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.2);
      pdf.setTextColor(...INK);
      pdf.text(chunk, MARGIN + (shaded ? 4 : 0), y + (shaded ? 4.5 : 0));
      y += height + 4;
      if (remaining.length) nextPage();
    }
  };
  const fields = (items: Array<{ label: string; value: string }>) => {
    const gap = 4;
    const width = (CONTENT_WIDTH - gap) / 2;
    for (let index = 0; index < items.length; index += 2) {
      const row = items.slice(index, index + 2).map((item) => ({ ...item, lines: pdf.splitTextToSize(normalizeProposalValue(item.value), width - 8) }));
      const height = Math.max(18, ...row.map((item) => 10 + item.lines.length * 4.1));
      ensureSpace(height + 3);
      row.forEach((item, column) => {
        const x = MARGIN + column * (width + gap);
        pdf.setFillColor(250, 251, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(x, y, width, height, 2, 2, "FD");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.2);
        pdf.setTextColor(...MUTED);
        pdf.text(item.label.toUpperCase(), x + 4, y + 5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.2);
        pdf.setTextColor(...INK);
        pdf.text(item.lines, x + 4, y + 10.3);
      });
      y += height + 3;
    }
  };

  section("Dados da proposta");
  fields([
    { label: "Codigo", value: data.proposalCode },
    { label: "Versao tecnica", value: `Versao ${data.versionNumber}` },
    { label: "Cliente", value: data.clientName },
    { label: "Validade", value: `${data.validityDays} dias` },
    { label: "Obra", value: [data.city, data.neighborhood].filter(Boolean).join(" - ") },
    { label: "Tipo de obra", value: data.projectType ?? "A confirmar" },
  ]);
  section("Investimento proposto");
  ensureSpace(28);
  pdf.setFillColor(...PRIMARY);
  pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, 24, 3, 3, "F");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(226, 232, 240);
  pdf.text("VALOR COMERCIAL", MARGIN + 6, y + 7);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(255, 255, 255);
  pdf.text(formatSteelFrameCurrency(data.salePrice), MARGIN + 6, y + 17);
  y += 29;
  section("Escopo comercial");
  paragraph(data.scope, true);
  if (data.notes?.trim()) {
    section("Premissas registradas");
    paragraph(data.notes, true);
  }
  if (data.materials.length) {
    nextPage();
    section("Relacao tecnica de materiais");
    paragraph("Quantidades estimadas para a versao tecnica desta proposta. Valores unitarios e custos internos nao integram este documento.", true);
    drawProposalMaterialsTable(pdf, data.materials, () => y, (value) => { y = value; }, nextPage);
  }
  section("Condicoes comerciais");
  paragraph(data.terms || "A confirmar em negociacao comercial.", true);
  // Keep the call to action and the acceptance lines together whenever possible.
  if (y + 66 > CONTENT_BOTTOM) {
    nextPage();
  }
  section("Proximos passos");
  paragraph("Esta proposta foi gerada a partir da versao tecnica aprovada. A confirmacao de escopo, condicoes e aceite deve ser registrada no CRM antes de qualquer alteracao de status.", true);
  drawProposalAcceptance(pdf, () => y, (value) => { y = value; }, nextPage);
  addProposalFooters(pdf, data.proposalCode);
}

function drawProposalMaterialsTable(
  pdf: ProposalPdfDocument,
  materials: SteelFrameProposalMaterialItem[],
  getY: () => number,
  setY: (value: number) => void,
  nextPage: () => void,
) {
  const numberWidth = 12;
  const quantityWidth = 25;
  const unitWidth = 22;
  const descriptionWidth = CONTENT_WIDTH - numberWidth - quantityWidth - unitWidth;
  const drawHeader = () => {
    let y = getY();
    if (y + 8 > CONTENT_BOTTOM) {
      nextPage();
      y = getY();
    }
    pdf.setFillColor(...PRIMARY);
    pdf.rect(MARGIN, y, CONTENT_WIDTH, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(255, 255, 255);
    pdf.text("#", MARGIN + 4, y + 5.2);
    pdf.text("QTD.", MARGIN + numberWidth + 4, y + 5.2);
    pdf.text("UN.", MARGIN + numberWidth + quantityWidth + 4, y + 5.2);
    pdf.text("DESCRICAO", MARGIN + numberWidth + quantityWidth + unitWidth + 4, y + 5.2);
    setY(y + 8);
  };

  let category: string | null = null;
  drawHeader();

  materials.forEach((item, index) => {
    let y = getY();
    if (item.category !== category) {
      if (y + 7 > CONTENT_BOTTOM) {
        nextPage();
        drawHeader();
        y = getY();
      }
      pdf.setFillColor(230, 238, 246);
      pdf.rect(MARGIN, y, CONTENT_WIDTH, 7, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.4);
      pdf.setTextColor(...PRIMARY);
      pdf.text(item.category.toUpperCase(), MARGIN + 4, y + 4.8);
      y += 7;
      setY(y);
      category = item.category;
    }

    const description = pdf.splitTextToSize(item.label, descriptionWidth - 8);
    const rowHeight = Math.max(7, description.length * 4.1 + 3);
    if (y + rowHeight > CONTENT_BOTTOM) {
      nextPage();
      drawHeader();
      y = getY();
    }
    if (index % 2 === 1) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "F");
    }
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.15);
    pdf.rect(MARGIN, y, CONTENT_WIDTH, rowHeight);
    pdf.rect(MARGIN + numberWidth, y, quantityWidth, rowHeight);
    pdf.rect(MARGIN + numberWidth + quantityWidth, y, unitWidth, rowHeight);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.1);
    pdf.setTextColor(...INK);
    pdf.text(String(index + 1), MARGIN + 4, y + 4.6);
    pdf.text(formatProposalQuantity(item.quantity), MARGIN + numberWidth + 4, y + 4.6);
    pdf.text(item.unit, MARGIN + numberWidth + quantityWidth + 4, y + 4.6);
    pdf.text(description, MARGIN + numberWidth + quantityWidth + unitWidth + 4, y + 4.6);
    setY(y + rowHeight);
  });

  setY(getY() + 4);
}

function drawProposalAcceptance(
  pdf: ProposalPdfDocument,
  getY: () => number,
  setY: (value: number) => void,
  nextPage: () => void,
) {
  let y = getY();
  const height = 29;
  if (y + height > CONTENT_BOTTOM) {
    nextPage();
    y = getY();
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11.5);
  pdf.setTextColor(...PRIMARY);
  pdf.text("Aceite da proposta", MARGIN, y + 5);
  pdf.setDrawColor(148, 163, 184);
  pdf.setLineWidth(0.25);
  pdf.rect(MARGIN, y + 11, CONTENT_WIDTH, 0.1, "F");
  pdf.rect(MARGIN, y + 21, CONTENT_WIDTH, 0.1, "F");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.7);
  pdf.setTextColor(...MUTED);
  pdf.text("Cliente ou responsavel", MARGIN, y + 9.2);
  pdf.text("Data", PAGE_WIDTH - MARGIN - 20, y + 9.2);
  pdf.text("Assinatura", MARGIN, y + 19.2);
  pdf.text("Telefone", PAGE_WIDTH - MARGIN - 20, y + 19.2);
  setY(y + height);
}

function formatProposalQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

function drawProposalHeader(pdf: ProposalPdfDocument, data: EstimateProposalPdfData, compact: boolean) {
  const height = compact ? 22 : 36;
  pdf.setFillColor(...PRIMARY);
  pdf.rect(0, 0, PAGE_WIDTH, height, "F");
  pdf.setFillColor(...ACCENT);
  pdf.rect(0, height - 1.5, PAGE_WIDTH, 1.5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(compact ? 14 : 17);
  pdf.setTextColor(255, 255, 255);
  pdf.text("NOVA FORMA", MARGIN, compact ? 10 : 13);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(compact ? 7.5 : 8.5);
  pdf.text("STEEL FRAME", MARGIN, compact ? 14.5 : 18);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(compact ? 9.5 : 12);
  pdf.text("PROPOSTA COMERCIAL", PAGE_WIDTH - MARGIN, compact ? 10 : 13, { align: "right" });
  if (!compact) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.2);
    pdf.text(`Cliente: ${normalizeProposalValue(data.clientName)}`, PAGE_WIDTH - MARGIN, 18, { align: "right" });
    pdf.text(`Gerada em ${data.generatedAt}`, PAGE_WIDTH - MARGIN, 22.5, { align: "right" });
    pdf.text(`Ref.: ${data.proposalCode}`, MARGIN, 29);
  }
  return height + 8;
}

function addProposalFooters(pdf: ProposalPdfDocument, proposalCode: string) {
  const total = pdf.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.2);
    pdf.rect(MARGIN, 284, CONTENT_WIDTH, 0.1, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.3);
    pdf.setTextColor(...MUTED);
    pdf.text(`Proposta ${proposalCode}`, MARGIN, 288.5);
    pdf.text(`Nova Forma Steel Frame | Pagina ${page} de ${total}`, PAGE_WIDTH - MARGIN, 288.5, { align: "right" });
  }
}

function normalizeProposalValue(value: string | null | undefined) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || "A confirmar";
}
