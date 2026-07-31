"use client";

import { useState } from "react";
import { Download, LoaderCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = 280;
const PRIMARY = [11, 37, 48] as const;
const ACCENT = [184, 120, 56] as const;
const INK = [31, 41, 55] as const;
const MUTED = [100, 116, 139] as const;

export type BriefingField = { label: string; value: string };
export type BriefingInteraction = { date: string; type: string; description: string; nextStep?: string | null };

export type VisitBriefingPdfData = {
  leadName: string;
  generatedAt: string;
  responsible: string;
  partner: string;
  customer: BriefingField[];
  visit: BriefingField[];
  project: BriefingField[];
  commercial: BriefingField[];
  visitSummary: string;
  checklist: string[];
  history: BriefingInteraction[];
  internalNotes: string;
};

type BriefingPdfDocument = {
  addPage: () => void;
  getNumberOfPages: () => number;
  roundedRect: (x: number, y: number, width: number, height: number, radiusX: number, radiusY: number, style?: string | null) => void;
  rect: (x: number, y: number, width: number, height: number, style?: string) => void;
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

type LeadBriefingActionsProps = {
  leadId: string;
  leadName: string;
  briefing: VisitBriefingPdfData;
};

export function LeadBriefingActions({ leadId, leadName, briefing }: LeadBriefingActionsProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function downloadPdf() {
    setIsExporting(true);

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ compress: true, format: "a4", orientation: "portrait", unit: "mm" });
      createVisitBriefingPdf(pdf, briefing);
      pdf.save(buildBriefingPdfFilename(leadName, leadId));
      toast.success("PDF do briefing baixado.");
    } catch (error) {
      toast.error(getBriefingPdfErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={downloadPdf} disabled={isExporting} aria-busy={isExporting}>
        {isExporting ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
        {isExporting ? "Gerando PDF..." : "Baixar PDF"}
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()} disabled={isExporting}>
        <Printer className="size-4" />
        Imprimir
      </Button>
    </div>
  );
}

export function getBriefingPdfErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Nao foi possivel gerar o PDF do briefing.";
  return message.includes("oklab")
    ? "O navegador carregou uma versao antiga da tela. Atualize a pagina e tente baixar novamente."
    : message;
}

export function createVisitBriefingPdf(pdf: BriefingPdfDocument, data: VisitBriefingPdfData) {
  let y = drawPageHeader(pdf, data, false);

  const nextPage = () => {
    pdf.addPage();
    y = drawPageHeader(pdf, data, true);
  };
  const ensureSpace = (height: number) => {
    if (y + height > CONTENT_BOTTOM) nextPage();
  };
  const section = (title: string) => {
    ensureSpace(12);
    pdf.setFillColor(...ACCENT);
    pdf.roundedRect(MARGIN, y, 4, 8, 1, 1, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...PRIMARY);
    pdf.text(title, MARGIN + 8, y + 5.6);
    y += 11;
  };
  const paragraph = (value: string, options?: { shaded?: boolean; fontSize?: number }) => {
    const fontSize = options?.fontSize ?? 9.5;
    const lineHeight = fontSize * 0.52;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...INK);
    const lines = pdf.splitTextToSize(normalizeValue(value), CONTENT_WIDTH - (options?.shaded ? 8 : 0));
    let remaining = [...lines];
    while (remaining.length) {
      const availableHeight = CONTENT_BOTTOM - y - (options?.shaded ? 6 : 0);
      const linesOnPage = Math.max(1, Math.floor(availableHeight / lineHeight));
      const chunk = remaining.splice(0, linesOnPage);
      const height = chunk.length * lineHeight + (options?.shaded ? 6 : 0);
      ensureSpace(height);
      if (options?.shaded) {
        pdf.setFillColor(246, 248, 250);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 2, 2, "FD");
      }
      pdf.setTextColor(...INK);
      pdf.text(chunk, MARGIN + (options?.shaded ? 4 : 0), y + (options?.shaded ? 4.4 : 0));
      y += height + 4;
      if (remaining.length) nextPage();
    }
  };
  const fieldGrid = (fields: BriefingField[]) => {
    const columnGap = 4;
    const cardWidth = (CONTENT_WIDTH - columnGap) / 2;
    for (let index = 0; index < fields.length; index += 2) {
      const row = fields.slice(index, index + 2).map((field) => ({
        ...field,
        lines: pdf.splitTextToSize(normalizeValue(field.value), cardWidth - 8),
      }));
      const height = Math.max(18, ...row.map((field) => 10 + field.lines.length * 4.2));
      ensureSpace(height + 3);
      row.forEach((field, column) => {
        const x = MARGIN + column * (cardWidth + columnGap);
        pdf.setFillColor(250, 251, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(x, y, cardWidth, height, 2, 2, "FD");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.3);
        pdf.setTextColor(...MUTED);
        pdf.text(field.label.toUpperCase(), x + 4, y + 5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.3);
        pdf.setTextColor(...INK);
        pdf.text(field.lines, x + 4, y + 10.4);
      });
      y += height + 3;
    }
  };

  section("Visita programada");
  fieldGrid(data.visit);
  section("Dados do cliente");
  fieldGrid(data.customer);
  section("Dados da obra");
  fieldGrid(data.project);
  section("Contexto comercial");
  fieldGrid(data.commercial);
  section("Resumo para a visita");
  paragraph(data.visitSummary, { shaded: true });
  section("Checklist de campo");
  drawChecklist(pdf, data.checklist, () => y, (value) => { y = value; }, nextPage);
  section("Historico resumido");
  if (data.history.length === 0) {
    paragraph("Nenhuma interacao registrada ate o momento.", { shaded: true });
  } else {
    for (const interaction of data.history) {
      const heading = `${interaction.date} - ${interaction.type}`;
      const detail = [interaction.description, interaction.nextStep ? `Proximo passo: ${interaction.nextStep}` : ""].filter(Boolean).join("\n");
      const detailLines = pdf.splitTextToSize(normalizeValue(detail), CONTENT_WIDTH - 12);
      const height = Math.max(18, 12 + detailLines.length * 4.2);
      ensureSpace(height + 3);
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.55);
      pdf.rect(MARGIN + 1, y + 1, 2.4, 2.4, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...PRIMARY);
      pdf.text(heading, MARGIN + 7, y + 4.4);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.7);
      pdf.setTextColor(...INK);
      pdf.text(detailLines, MARGIN + 7, y + 9.6);
      y += height + 3;
    }
  }
  section("Anotacoes para retorno");
  paragraph(data.internalNotes, { shaded: true });
  drawNotesArea(pdf, () => y, (value) => { y = value; }, nextPage);
  addPageFooters(pdf, data.leadName);
}

function drawPageHeader(pdf: BriefingPdfDocument, data: VisitBriefingPdfData, compact: boolean) {
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
  pdf.text("BRIEFING DE VISITA", PAGE_WIDTH - MARGIN, compact ? 10 : 13, { align: "right" });
  if (!compact) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.2);
    pdf.text(`Cliente: ${normalizeValue(data.leadName)}`, PAGE_WIDTH - MARGIN, 18, { align: "right" });
    pdf.text(`Gerado em ${data.generatedAt}`, PAGE_WIDTH - MARGIN, 22.5, { align: "right" });
    pdf.setFontSize(8.5);
    pdf.text(`Responsavel interno: ${normalizeValue(data.responsible)}  |  Parceiro: ${normalizeValue(data.partner)}`, MARGIN, 29);
  }
  return height + 8;
}

function drawChecklist(pdf: BriefingPdfDocument, checklist: string[], getY: () => number, setY: (value: number) => void, nextPage: () => void) {
  let y = getY();
  for (const item of checklist) {
    const lines = pdf.splitTextToSize(normalizeValue(item), CONTENT_WIDTH - 11);
    const height = Math.max(8, lines.length * 4.4 + 3);
    if (y + height > CONTENT_BOTTOM) {
      nextPage();
      y = getY();
    }
    pdf.setDrawColor(148, 163, 184);
    pdf.setLineWidth(0.4);
    pdf.rect(MARGIN, y + 1, 3.5, 3.5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.2);
    pdf.setTextColor(...INK);
    pdf.text(lines, MARGIN + 6, y + 4);
    y += height;
  }
  setY(y + 3);
}

function drawNotesArea(pdf: BriefingPdfDocument, getY: () => number, setY: (value: number) => void, nextPage: () => void) {
  let y = getY();
  const lineGap = 8;
  for (let line = 0; line < 7; line += 1) {
    if (y + lineGap > CONTENT_BOTTOM) {
      nextPage();
      y = getY();
    }
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.25);
    pdf.rect(MARGIN, y + 4.5, CONTENT_WIDTH, 0.1, "F");
    y += lineGap;
  }
  setY(y);
}

function addPageFooters(pdf: BriefingPdfDocument, leadName: string) {
  const total = pdf.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.2);
    pdf.rect(MARGIN, 284, CONTENT_WIDTH, 0.1, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.3);
    pdf.setTextColor(...MUTED);
    pdf.text(`Uso interno - ${normalizeValue(leadName)}`, MARGIN, 288.5);
    pdf.text(`Nova Forma Steel Frame | Pagina ${page} de ${total}`, PAGE_WIDTH - MARGIN, 288.5, { align: "right" });
  }
}

function normalizeValue(value: string | null | undefined) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || "A confirmar";
}

export function buildBriefingPdfFilename(leadName: string, leadId: string) {
  const safeName = leadName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const date = new Date().toISOString().slice(0, 10);

  return `briefing-visita-${safeName || leadId}-${date}.pdf`;
}
