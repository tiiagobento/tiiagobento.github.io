"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_REPLY_IMAGE_MAX_COUNT,
  AI_REPLY_IMAGE_TOTAL_MAX_BYTES,
  AI_REPLY_IMAGE_TOTAL_SIZE_MESSAGE,
  dataUrlToGeminiInlineData,
  fileToDataUrl,
  validateImageFile,
} from "@/lib/ai/image-utils";
import type { Lead } from "@/lib/types";

const REQUEST_TIMEOUT_MS = 28_000;

type AttachedPrint = {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
};

type GenerateReplyResponse = {
  message?: string;
  warnings?: string[];
  error?: string;
};

export function AIReplyComposer({ lead, onGenerated }: { lead: Lead; onGenerated: (message: string) => void }) {
  const [latestMessage, setLatestMessage] = React.useState("");
  const [prints, setPrints] = React.useState<AttachedPrint[]>([]);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  async function addPrints(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const available = AI_REPLY_IMAGE_MAX_COUNT - prints.length;
    if (available <= 0) {
      toast.error(`Envie no maximo ${AI_REPLY_IMAGE_MAX_COUNT} prints por resposta.`);
      return;
    }

    if (files.length > available) {
      toast.error(`Foram selecionados mais arquivos do que o limite de ${AI_REPLY_IMAGE_MAX_COUNT} prints.`);
    }

    const nextPrints: AttachedPrint[] = [];
    let availableBytes = AI_REPLY_IMAGE_TOTAL_MAX_BYTES - prints.reduce((total, print) => total + print.size, 0);
    for (const [index, file] of files.slice(0, available).entries()) {
      const validationError = validateImageFile(file);
      if (validationError) {
        toast.error(`${file.name}: ${validationError}`);
        continue;
      }

      if (file.size > availableBytes) {
        toast.error(AI_REPLY_IMAGE_TOTAL_SIZE_MESSAGE);
        continue;
      }

      try {
        const dataUrl = await fileToDataUrl(file);
        nextPrints.push({
          id: `${file.name}-${file.lastModified}-${index}`,
          name: file.name,
          size: file.size,
          dataUrl,
        });
        availableBytes -= file.size;
      } catch {
        toast.error(`Nao foi possivel ler o print ${file.name}.`);
      }
    }

    if (nextPrints.length) {
      setPrints((current) => [...current, ...nextPrints]);
      setError(null);
    }
  }

  function removePrint(id: string) {
    setPrints((current) => current.filter((print) => print.id !== id));
  }

  async function generateReply() {
    if (!latestMessage.trim() && !prints.length) {
      const message = "Cole a ultima mensagem do cliente ou envie ao menos um print.";
      setError(message);
      toast.error(message);
      return;
    }

    setError(null);
    setWarnings([]);
    setIsGenerating(true);
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch("/api/ai/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          objective: "Responder a ultima mensagem do cliente e manter o atendimento comercial avancando.",
          context: latestMessage.trim(),
          tone: "cordial",
          lead: {
            name: lead.name,
            city: lead.city,
            neighborhood: lead.neighborhood,
            project_type: lead.project_type,
            interest_type: lead.interest_type,
            status: lead.status,
            priority: lead.priority,
            has_land: lead.has_land,
            has_blueprint: lead.has_blueprint,
            desired_start_time: lead.desired_start_time,
            budget_range: lead.budget_range,
            notes: lead.notes,
          },
          images: prints.map((print) => dataUrlToGeminiInlineData(print.dataUrl)),
        }),
      });
      const payload = await response.json().catch(() => ({})) as GenerateReplyResponse;
      if (!response.ok || !payload.message?.trim()) {
        throw new Error(payload.error || "A IA nao conseguiu gerar uma resposta. Tente novamente.");
      }

      onGenerated(payload.message.trim());
      setWarnings(payload.warnings ?? []);
      toast.success("Resposta sugerida pela IA. Revise antes de enviar.");
    } catch (caughtError) {
      const message = timedOut
        ? "A IA demorou mais que o esperado. Tente novamente em instantes."
        : caughtError instanceof Error
          ? caughtError.message
          : "Nao foi possivel gerar a resposta com IA.";
      setError(message);
      toast.error(message);
    } finally {
      window.clearTimeout(timeout);
      setIsGenerating(false);
    }
  }

  return (
    <section className="space-y-3 border-t pt-4" aria-labelledby="ai-reply-title">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        <div>
          <p id="ai-reply-title" className="text-sm font-medium">Resposta com IA</p>
          <p className="text-xs leading-5 text-muted-foreground">Cole a ultima mensagem ou envie um print. A sugestao fica editavel antes de abrir o WhatsApp.</p>
        </div>
      </div>

      <label htmlFor="latest-client-message" className="text-sm font-medium">Ultima mensagem do cliente</label>
      <Textarea
        id="latest-client-message"
        value={latestMessage}
        onChange={(event) => setLatestMessage(event.target.value.slice(0, 10_000))}
        placeholder="Cole aqui a ultima mensagem ou a conversa recente..."
        className="min-h-28"
        maxLength={10_000}
      />
      <p className="text-right text-xs text-muted-foreground">{latestMessage.length.toLocaleString("pt-BR")}/10.000</p>

      <div className="space-y-2">
        <label htmlFor="reply-print-upload" className="text-sm font-medium">Print da conversa (opcional)</label>
        <Input id="reply-print-upload" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" multiple onChange={addPrints} />
        <p className="text-xs leading-5 text-muted-foreground">PNG, JPG, JPEG ou WEBP, ate 5 MB cada e 13 MB no total. As imagens servem apenas para a analise e nao sao salvas.</p>
      </div>

      {prints.length ? (
        <div className="grid grid-cols-3 gap-2" aria-label="Prints anexados">
          {prints.map((print) => (
            <div key={print.id} className="relative aspect-square min-w-0 overflow-hidden rounded-lg border bg-muted/25">
              <Image src={print.dataUrl} alt={`Preview do print ${print.name}`} fill unoptimized sizes="(max-width: 640px) 33vw, 106px" className="object-cover" />
              <Button type="button" variant="secondary" size="icon" className="absolute right-1 top-1 size-7 shadow-sm" onClick={() => removePrint(print.id)} aria-label={`Remover print ${print.name}`}>
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {warnings.map((warning) => <p key={warning} className="text-xs leading-5 text-amber-700 dark:text-amber-300">{warning}</p>)}

      <Button type="button" variant="outline" className="w-full" onClick={() => void generateReply()} disabled={isGenerating}>
        {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        {isGenerating ? "Analisando conversa..." : "Gerar resposta com IA"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">Revise a resposta antes de enviar. A IA pode interpretar alguma informacao de forma errada.</p>
    </section>
  );
}
