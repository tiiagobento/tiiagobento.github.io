"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase/client";
import type { PartnerNotification } from "@/lib/types";

function notificationHref(notification: PartnerNotification) {
  if (!notification.lead_id) return "/partner";
  if (["partner_visit_reported", "partner_visit_completed", "partner_sale_reported", "partner_transfer_reported", "partner_transfer_confirmed"].includes(notification.type)) {
    return `/leads/${notification.lead_id}`;
  }
  return `/leads/${notification.lead_id}/briefing`;
}

function relativeTime(value: string) {
  const differenceMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (differenceMinutes < 1) return "Agora";
  if (differenceMinutes < 60) return `${differenceMinutes} min`;
  const differenceHours = Math.floor(differenceMinutes / 60);
  if (differenceHours < 24) return `${differenceHours} h`;
  return `${Math.floor(differenceHours / 24)} d`;
}

export function NotificationCenter() {
  const [items, setItems] = React.useState<PartnerNotification[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadNotifications = React.useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from("partner_notifications")
      .select("id, user_id, lead_id, type, title, body, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(12);
    setItems((data ?? []) as PartnerNotification[]);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = items.filter((item) => !item.read_at).length;

  async function markRead(id: string) {
    if (!supabase) return;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: readAt } : item));
    await supabase.from("partner_notifications").update({ read_at: readAt }).eq("id", id);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="relative size-11 min-h-11 min-w-11" aria-label={unreadCount ? `${unreadCount} notificacoes nao lidas` : "Abrir notificacoes"}>
          {unreadCount ? <BellRing className="size-4" /> : <Bell className="size-4" />}
          {unreadCount ? <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-b p-5 pr-12">
          <DialogTitle>Notificacoes</DialogTitle>
          <DialogDescription>Delegacoes, retornos de visita e atualizacoes de repasse.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
          {loading ? <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando notificacoes...</div> : null}
          {!loading && !items.length ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhuma notificacao por enquanto.</p> : null}
          {items.map((notification) => (
            <Link
              key={notification.id}
              href={notificationHref(notification)}
              onClick={() => void markRead(notification.id)}
              className={`block rounded-xl border p-3 transition hover:border-accent/50 hover:bg-secondary/45 ${notification.read_at ? "bg-card" : "border-accent/35 bg-accent/[0.055]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">{notification.title}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(notification.created_at)}</span>
              </div>
              {notification.body ? <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p> : null}
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
