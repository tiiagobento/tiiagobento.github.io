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
  green: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  red: "bg-red-100 text-red-700 ring-red-200",
};

export function MetricCard({ title, value, subtitle, icon: Icon, tone = "default" }: MetricCardProps) {
  return (
    <Card className="group overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-950/[0.07]">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-normal">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className={cn("flex size-11 items-center justify-center rounded-xl ring-1 transition group-hover:scale-105", tones[tone])}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
