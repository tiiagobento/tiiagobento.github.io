"use client";

import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { LeadTable } from "@/components/lead-table";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useCrmData } from "@/hooks/use-crm-data";

export default function LeadsPage() {
  const { leads, loading, deleteLead, updateLead, recordLastContact, addInteraction } = useCrmData();
  if (loading) return <LoadingSkeleton />;
  return (
    <div className="space-y-5">
      <Card className="page-hero">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/72">Tabela comercial com filtros, score, status e acoes rapidas para transformar contatos em visitas e orcamentos.</p>
        </div>
        <Button asChild variant="accent" className="shrink-0">
          <Link href="/leads/new">
            <Plus className="size-4" />
            Novo lead
          </Link>
        </Button>
        </CardContent>
      </Card>
      {leads.length ? (
        <LeadTable leads={leads} onDelete={deleteLead} onUpdateLead={updateLead} onRecordLastContact={recordLastContact} onAddInteraction={addInteraction} />
      ) : (
        <EmptyState icon={Users} title="Nenhum lead cadastrado" description="Cadastre o primeiro lead para iniciar o acompanhamento comercial." />
      )}
    </div>
  );
}
