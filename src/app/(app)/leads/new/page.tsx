"use client";

import { useRouter } from "next/navigation";
import { LeadForm } from "@/components/lead-form";
import { Card, CardContent } from "@/components/ui/card";
import { useCrmData } from "@/hooks/use-crm-data";
import type { LeadFormValues } from "@/lib/schemas";
import { Plus } from "lucide-react";

export default function NewLeadPage() {
  const router = useRouter();
  const { saveLead } = useCrmData();
  async function submit(values: LeadFormValues) {
    const lead = await saveLead(values);
    router.push(`/leads/${lead.id}`);
  }
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Card className="overflow-hidden border-primary/10 bg-primary text-primary-foreground shadow-lg">
        <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-accent">
            <Plus className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Novo lead</h1>
            <p className="mt-1 text-sm text-white/72">Cadastre e qualifique uma nova oportunidade de obra.</p>
          </div>
        </CardContent>
      </Card>
      <LeadForm onSubmit={submit} />
    </div>
  );
}
