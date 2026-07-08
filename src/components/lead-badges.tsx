import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { scoreLabel } from "@/lib/business";
import type { LeadStatus, Priority } from "@/lib/types";

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const variant = status === "Fechado" ? "success" : status === "Perdido" ? "danger" : status.includes("Orcamento") ? "gold" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

export function LeadPriorityBadge({ priority }: { priority: Priority }) {
  const variant = priority === "Alta" ? "danger" : priority === "Media" ? "warning" : "outline";
  return <Badge variant={variant}>{priority}</Badge>;
}

export function LeadScoreBadge({ score }: { score: number }) {
  const variant = score >= 70 ? "success" : score >= 40 ? "warning" : "outline";
  return (
    <div className="min-w-36">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Badge variant={variant}>{scoreLabel(score)}</Badge>
        <span className="text-xs font-medium">{score}</span>
      </div>
      <Progress value={score} />
    </div>
  );
}
