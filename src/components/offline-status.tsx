"use client";

import * as React from "react";
import { CheckCircle2, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNetworkStatus } from "@/lib/offline/network-status";
import { getSyncSummary, type SyncSummary } from "@/lib/offline/sync-queue";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function OfflineStatus({ compact = false }: { compact?: boolean }) {
  const network = useNetworkStatus();
  const [summary, setSummary] = React.useState<SyncSummary>({ pending: 0, failed: 0, conflict: 0, operations: [] });

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const next = await getSyncSummary(data.session?.user.id);
      if (mounted) setSummary(next);
    }
    void load();
    window.addEventListener("novaforma:sync-queue-changed", load);
    window.addEventListener("online", load);
    window.addEventListener("offline", load);
    return () => {
      mounted = false;
      window.removeEventListener("novaforma:sync-queue-changed", load);
      window.removeEventListener("online", load);
      window.removeEventListener("offline", load);
    };
  }, []);

  const hasErrors = summary.failed > 0 || summary.conflict > 0;
  const hasPending = summary.pending > 0;
  const label = !network.online
    ? compact
      ? "Offline"
      : "Offline - alteracoes serao salvas e sincronizadas depois"
    : hasErrors
      ? "Algumas alteracoes precisam de atencao"
      : hasPending
        ? compact
          ? `Sincronizando (${summary.pending})`
          : "Sincronizando alteracoes..."
        : "Online";
  const Icon = !network.online ? CloudOff : hasErrors ? TriangleAlert : hasPending ? RefreshCw : CheckCircle2;

  return (
    <Badge
      variant={!network.online || hasErrors ? "warning" : "secondary"}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-[11px] sm:px-3 sm:text-xs", !network.online && "border-amber-300")}
      title={label}
    >
      <Icon className={cn("size-3.5", hasPending && network.online && "animate-spin")} />
      {label}
    </Badge>
  );
}
