"use client";

import Link from "next/link";
import { format, isBefore, parseISO, startOfToday } from "date-fns";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { LeadPriorityBadge } from "@/components/lead-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Lead, Task } from "@/lib/types";

export function TaskList({ tasks, leads, onComplete }: { tasks: Task[]; leads: Lead[]; onComplete: (id: string) => Promise<void> }) {
  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const lead = leads.find((item) => item.id === task.lead_id);
        const overdue = task.status !== "concluida" && isBefore(parseISO(task.due_date), startOfToday());
        return (
          <Card key={task.id} className={overdue ? "border-red-200 bg-red-50/45 shadow-red-950/[0.04] dark:border-red-900/60 dark:bg-red-950/18 dark:shadow-black/20" : "premium-hover"}>
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-primary">{task.title}</h3>
                  <LeadPriorityBadge priority={task.priority} />
                  {overdue ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/35 dark:text-red-200 dark:ring-1 dark:ring-red-900/50">Atrasada</span> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lead?.name ?? "Sem lead"} - {format(new Date(task.due_date), "dd/MM/yyyy HH:mm")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {lead ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/leads/${lead.id}`}>
                      <ExternalLink className="size-4" />
                      Lead
                    </Link>
                  </Button>
                ) : null}
                {task.status !== "concluida" ? (
                  <Button variant="outline" size="sm" onClick={() => onComplete(task.id)}>
                    <CheckCircle2 className="size-4" />
                    Concluir
                  </Button>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/35 dark:text-emerald-200 dark:ring-emerald-900/50">Concluida</span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
