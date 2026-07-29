-- Remote push notifications for the Android Capacitor app.
-- This migration is additive: it does not delete CRM records or relax RLS.

create table if not exists public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('android')),
  device_label text,
  last_seen_at timestamp with time zone not null default now(),
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.push_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.partner_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  deep_link text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  sent_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.push_notification_deliveries drop constraint if exists push_notification_deliveries_status_check;
alter table public.push_notification_deliveries add constraint push_notification_deliveries_status_check
check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')) not valid;

create index if not exists push_device_tokens_active_user_idx
  on public.push_device_tokens(user_id, last_seen_at desc) where revoked_at is null;
create index if not exists push_notification_deliveries_pending_idx
  on public.push_notification_deliveries(status, created_at asc) where status = 'pending';

create or replace function public.set_push_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_device_tokens_set_updated_at on public.push_device_tokens;
create trigger push_device_tokens_set_updated_at
before update on public.push_device_tokens
for each row execute function public.set_push_updated_at();

drop trigger if exists push_notification_deliveries_set_updated_at on public.push_notification_deliveries;
create trigger push_notification_deliveries_set_updated_at
before update on public.push_notification_deliveries
for each row execute function public.set_push_updated_at();

alter table public.push_device_tokens enable row level security;
alter table public.push_notification_deliveries enable row level security;

drop policy if exists "push_device_tokens_select_own" on public.push_device_tokens;
drop policy if exists "push_device_tokens_insert_own" on public.push_device_tokens;
drop policy if exists "push_device_tokens_update_own" on public.push_device_tokens;
drop policy if exists "push_device_tokens_delete_own" on public.push_device_tokens;
create policy "push_device_tokens_select_own" on public.push_device_tokens
for select using (auth.uid() = user_id and public.current_profile_is_active());
create policy "push_device_tokens_insert_own" on public.push_device_tokens
for insert with check (auth.uid() = user_id and public.current_profile_is_active());
create policy "push_device_tokens_update_own" on public.push_device_tokens
for update using (auth.uid() = user_id and public.current_profile_is_active())
with check (auth.uid() = user_id and public.current_profile_is_active());
create policy "push_device_tokens_delete_own" on public.push_device_tokens
for delete using (auth.uid() = user_id and public.current_profile_is_active());

drop policy if exists "push_deliveries_select_recipient" on public.push_notification_deliveries;
create policy "push_deliveries_select_recipient" on public.push_notification_deliveries
for select using (auth.uid() = user_id and public.current_profile_is_active());

create or replace function public.register_push_device_token(
  registration_token text,
  registration_platform text default 'android',
  registration_device_label text default null
)
returns public.push_device_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  registered_token public.push_device_tokens;
begin
  if auth.uid() is null or not public.current_profile_is_active() then
    raise exception 'Sessao ativa necessaria para registrar notificacoes';
  end if;

  if coalesce(length(trim(registration_token)), 0) < 20 then
    raise exception 'Token de notificacao invalido';
  end if;

  if registration_platform <> 'android' then
    raise exception 'Plataforma de notificacao invalida';
  end if;

  insert into public.push_device_tokens (user_id, token, platform, device_label, last_seen_at, revoked_at)
  values (auth.uid(), trim(registration_token), registration_platform, nullif(trim(registration_device_label), ''), now(), null)
  on conflict (token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    device_label = excluded.device_label,
    last_seen_at = now(),
    revoked_at = null
  returning * into registered_token;

  return registered_token;
end;
$$;

create or replace function public.revoke_push_device_token(registration_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessao necessaria para remover notificacoes';
  end if;

  update public.push_device_tokens
  set revoked_at = now(), last_seen_at = now()
  where user_id = auth.uid() and token = trim(registration_token);
end;
$$;

create or replace function public.enqueue_partner_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.push_notification_deliveries (notification_id, user_id, deep_link)
  values (
    new.id,
    new.user_id,
    case when new.lead_id is null then '/partner' else concat('/leads/', new.lead_id::text, '/briefing') end
  )
  on conflict (notification_id) do nothing;
  return new;
end;
$$;

drop trigger if exists partner_notifications_enqueue_push on public.partner_notifications;
create trigger partner_notifications_enqueue_push
after insert on public.partner_notifications
for each row execute function public.enqueue_partner_notification_push();

alter table public.partner_notifications drop constraint if exists partner_notifications_type_check;
alter table public.partner_notifications add constraint partner_notifications_type_check
check (type in (
  'visit_briefing_assigned', 'visit_briefing_updated', 'visit_assigned', 'visit_rescheduled',
  'visit_status_updated', 'feedback_requested', 'deadline_approaching', 'partner_feedback_received'
)) not valid;

create or replace function public.notify_lead_owner_partner_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partner_visit_feedback is distinct from old.partner_visit_feedback
    and nullif(trim(coalesce(new.partner_visit_feedback, '')), '') is not null
    and new.user_id is not null
    and new.user_id is distinct from new.partner_id then
    insert into public.partner_notifications (user_id, lead_id, type, title, body)
    values (
      new.user_id,
      new.id,
      'partner_feedback_received',
      'Retorno de parceiro recebido',
      concat('O parceiro registrou o retorno da visita de ', new.name, '.')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists leads_notify_owner_partner_feedback on public.leads;
create trigger leads_notify_owner_partner_feedback
after update of partner_visit_feedback on public.leads
for each row execute function public.notify_lead_owner_partner_feedback();

grant select, insert, update, delete on table public.push_device_tokens to authenticated;
grant select on table public.push_notification_deliveries to authenticated;
grant execute on function public.register_push_device_token(text, text, text) to authenticated;
grant execute on function public.revoke_push_device_token(text) to authenticated;
