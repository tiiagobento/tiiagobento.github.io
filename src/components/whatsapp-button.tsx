"use client";

import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { applyTemplate, buildWhatsAppUrl } from "@/lib/business";
import type { Lead } from "@/lib/types";

export function WhatsAppButton({ lead, message, size = "default" }: { lead: Lead; message?: string; size?: "sm" | "default" | "lg" | "icon" }) {
  const text = message ? applyTemplate(message, lead) : undefined;
  const href = buildWhatsAppUrl(lead.phone, text);
  function openWhatsApp() {
    if (!href) {
      toast.error("Telefone incompleto ou invalido para abrir o WhatsApp.");
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <Button type="button" variant="accent" size={size} onClick={openWhatsApp}>
      <MessageCircle className="size-4" />
      {size === "icon" ? null : "WhatsApp"}
    </Button>
  );
}
