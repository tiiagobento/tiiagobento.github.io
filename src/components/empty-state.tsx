import type React from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <Card className="border-dashed bg-card/78">
      <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/20">
          <Icon className="size-6 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-primary">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
