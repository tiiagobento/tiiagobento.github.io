"use client";

import Link from "next/link";
import { CalendarClock, ExternalLink, MapPin, Phone } from "lucide-react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { LeadPriorityBadge, LeadScoreBadge, LeadStatusBadge } from "@/components/lead-badges";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { Button } from "@/components/ui/button";
import { daysSinceLastContact, isStaleLead } from "@/lib/business";
import type { Lead } from "@/lib/types";

export function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Card className="premium-hover group">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/leads/${lead.id}`} className="font-semibold transition group-hover:text-accent">
              {lead.name}
            </Link>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="size-3.5" />
              {lead.phone}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />
              {[lead.city, lead.neighborhood].filter(Boolean).join(" / ") || "Local a confirmar"}
            </p>
          </div>
          <LeadPriorityBadge priority={lead.priority} />
        </div>
        <div className="flex flex-wrap gap-2">
          <LeadStatusBadge status={lead.status} />
          <LeadPriorityBadge priority={lead.priority} />
          {isStaleLead(lead) ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950/35 dark:text-red-200 dark:ring-1 dark:ring-red-900/50">Sem retorno {daysSinceLastContact(lead)}d</span> : null}
        </div>
        <div className="rounded-xl bg-secondary/35 p-3">
          <p className="line-clamp-2 text-sm text-muted-foreground">{lead.notes || lead.interest_type || lead.project_type || "Lead ainda sem observacoes."}</p>
          <p className="mt-2 text-xs font-medium text-primary">
            Proximo passo: <span className="text-muted-foreground">{lead.next_action_at ? formatDistanceToNowStrict(parseISO(lead.next_action_at), { addSuffix: true, locale: ptBR }) : "A definir"}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LeadScoreBadge score={lead.lead_score} />
          <span className="rounded-full bg-background px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">{lead.source}</span>
        </div>
        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {lead.last_contact_at
              ? formatDistanceToNowStrict(parseISO(lead.last_contact_at), { addSuffix: true, locale: ptBR })
              : "Sem contato registrado"}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/leads/${lead.id}`}>
                <ExternalLink className="size-4" />
                Abrir
              </Link>
            </Button>
            <WhatsAppButton lead={lead} size="sm" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
