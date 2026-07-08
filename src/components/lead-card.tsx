"use client";

import Link from "next/link";
import { CalendarClock, MapPin } from "lucide-react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { LeadPriorityBadge, LeadScoreBadge, LeadStatusBadge } from "@/components/lead-badges";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { daysSinceLastContact, isStaleLead } from "@/lib/business";
import type { Lead } from "@/lib/types";

export function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Card className="group transition duration-200 hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-md hover:shadow-slate-950/[0.07]">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/leads/${lead.id}`} className="font-semibold transition group-hover:text-accent">
              {lead.name}
            </Link>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />
              {[lead.city, lead.neighborhood].filter(Boolean).join(" / ") || "Local a confirmar"}
            </p>
          </div>
          <LeadPriorityBadge priority={lead.priority} />
        </div>
        <div className="flex flex-wrap gap-2">
          <LeadStatusBadge status={lead.status} />
          {isStaleLead(lead) ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">Sem retorno {daysSinceLastContact(lead)}d</span> : null}
        </div>
        <p className="line-clamp-2 rounded-md bg-secondary/35 p-3 text-sm text-muted-foreground">{lead.notes || lead.interest_type || lead.project_type || "Lead ainda sem observacoes."}</p>
        <LeadScoreBadge score={lead.lead_score} />
        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {lead.last_contact_at
              ? formatDistanceToNowStrict(parseISO(lead.last_contact_at), { addSuffix: true, locale: ptBR })
              : "Sem contato registrado"}
          </p>
          <WhatsAppButton lead={lead} size="sm" />
        </div>
      </CardContent>
    </Card>
  );
}
