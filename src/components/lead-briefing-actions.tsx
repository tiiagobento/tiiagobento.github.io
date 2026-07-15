"use client";

import { useState } from "react";
import { Download, LoaderCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const PDF_PAGE_WIDTH_MM = 210;
const PDF_PAGE_HEIGHT_MM = 297;
const PDF_MARGIN_MM = 10;

type LeadBriefingActionsProps = {
  leadId: string;
  leadName: string;
};

export function LeadBriefingActions({ leadId, leadName }: LeadBriefingActionsProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function downloadPdf() {
    const documentElement = window.document.getElementById("visit-briefing-document");
    if (!documentElement) {
      toast.error("Nao encontramos o conteudo do briefing para gerar o PDF.");
      return;
    }

    setIsExporting(true);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(documentElement, {
        backgroundColor: "#ffffff",
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        windowWidth: documentElement.scrollWidth,
      });

      if (!canvas.width || !canvas.height) {
        throw new Error("O briefing nao possui conteudo suficiente para exportar.");
      }

      const pdf = new jsPDF({
        compress: true,
        format: "a4",
        orientation: "portrait",
        unit: "mm",
      });
      const imageData = canvas.toDataURL("image/jpeg", 0.94);
      const printableWidth = PDF_PAGE_WIDTH_MM - PDF_MARGIN_MM * 2;
      const printableHeight = PDF_PAGE_HEIGHT_MM - PDF_MARGIN_MM * 2;
      const imageHeight = (canvas.height * printableWidth) / canvas.width;
      let renderedHeight = 0;

      while (renderedHeight < imageHeight) {
        if (renderedHeight > 0) pdf.addPage();

        pdf.addImage(
          imageData,
          "JPEG",
          PDF_MARGIN_MM,
          PDF_MARGIN_MM - renderedHeight,
          printableWidth,
          imageHeight,
          undefined,
          "FAST",
        );
        renderedHeight += printableHeight;
      }

      pdf.save(buildBriefingPdfFilename(leadName, leadId));
      toast.success("PDF do briefing baixado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel gerar o PDF do briefing.");
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
