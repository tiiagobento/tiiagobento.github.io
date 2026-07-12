import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  tone?: "default" | "gold" | "green" | "red";
};

const tones = {
  default: "bg-primary/8 text-primary ring-primary/10",
  gold: "bg-accent/15 text-accent ring-accent/15",
  green: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/45 dark:text-emerald-200 dark:ring-emerald-800/70",
  red: "bg-red-100 text-red-700 ring-red-200 dark:bg-red-950/45 dark:text-red-200 dark:ring-red-800/70",
};

export function MetricCard({ title, value, subtitle, icon: Icon, tone = "default" }: MetricCardProps) {
  return (
    <Card className="premium-hover group overflow-hidden">
      <CardContent className="flex min-h-28 items-start justify-between gap-3 p-3 sm:gap-4 sm:p-5">
        <div className="min-w-0">
          <p className="line-clamp-2 text-xs font-medium leading-snug text-muted-foreground sm:text-sm">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-normal text-primary sm:text-3xl">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 transition group-hover:scale-105 sm:size-11", tones[tone])}>
          <Icon className="size-4 sm:size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
