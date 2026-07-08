"use client";

import { format, isBefore, parseISO, startOfToday } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LeadPriorityBadge } from "@/components/lead-badges";
import type { Lead, Task } from "@/lib/types";

export function TaskList({ tasks, leads, onComplete }: { tasks: Task[]; leads: Lead[]; onComplete: (id: string) => Promise<void> }) {
  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const lead = leads.find((item) => item.id === task.lead_id);
        const overdue = task.status !== "concluida" && isBefore(parseISO(task.due_date), startOfToday());
        return (
          <Card key={task.id} className={overdue ? "border-red-200 bg-red-50/50" : ""}>
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{task.title}</h3>
                  <LeadPriorityBadge priority={task.priority} />
                  {overdue ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Atrasada</span> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lead?.name ?? "Sem lead"} · {format(new Date(task.due_date), "dd/MM/yyyy HH:mm")}
                </p>
              </div>
              {task.status !== "concluida" ? (
                <Button variant="outline" onClick={() => onComplete(task.id)}>
                  <CheckCircle2 className="size-4" />
                  Concluir
                </Button>
              ) : (
                <span className="text-sm text-emerald-700">Concluida</span>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
