create table if not exists public.partner_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  type text not null check (type in ('visit_briefing_assigned', 'visit_briefing_updated')),
  title text not null,
  body text,
  read_at timestamp with time zone,
  created_at timestamp with time zone default current_timestamp
);

alter table public.partner_notifications enable row level security;

drop policy if exists "partner_notifications_select_recipient_or_admin" on public.partner_notifications;
create policy "partner_notifications_select_recipient_or_admin" on public.partner_notifications
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "partner_notifications_update_recipient_or_admin" on public.partner_notifications;
create policy "partner_notifications_update_recipient_or_admin" on public.partner_notifications
for update using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

create index if not exists partner_notifications_user_created_idx on public.partner_notifications(user_id, created_at desc);

create or replace function public.notify_partner_visit_briefing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_type text;
  notification_title text;
  notification_body text;
begin
  if new.partner_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' or new.partner_id is distinct from old.partner_id then
    notification_type := 'visit_briefing_assigned';
    notification_title := 'Novo briefing de visita';
  else
    notification_type := 'visit_briefing_updated';
    notification_title := 'Briefing de visita atualizado';
  end if;

  notification_body := concat(
    'Lead ', new.name,
    case
      when new.visit_scheduled_at is null then '. Data da visita a confirmar.'
      else concat('. Visita: ', to_char(new.visit_scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), '.')
    end
  );

  insert into public.partner_notifications (user_id, lead_id, type, title, body)
  values (new.partner_id, new.id, notification_type, notification_title, notification_body);

  return new;
end;
$$;

drop trigger if exists leads_notify_partner_visit_briefing on public.leads;
create trigger leads_notify_partner_visit_briefing
after insert or update of partner_id, visit_scheduled_at, visit_status on public.leads
for each row execute function public.notify_partner_visit_briefing();

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles, public.leads, public.interactions, public.tasks, public.message_templates to authenticated;
grant select, update on table public.partner_notifications to authenticated;
