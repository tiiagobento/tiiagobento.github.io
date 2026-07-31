-- Partner sales, 5% commission tracking and private lead attachments.
-- This migration is additive: it does not delete CRM records or disable RLS.

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete restrict,
  sale_amount numeric(14, 2) not null check (sale_amount > 0),
  commission_rate numeric(5, 4) not null default 0.0500 check (commission_rate = 0.0500),
  commission_amount numeric(14, 2) not null check (commission_amount >= 0),
  sale_closed_at date not null,
  transfer_due_date date,
  transfer_reference text,
  status text not null default 'awaiting_transfer' check (status in ('awaiting_transfer', 'transfer_reported', 'confirmed', 'cancelled')),
  reported_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  confirmed_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.lead_files (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 15728640),
  category text not null check (category in ('Planta/projeto', 'Orcamento', 'Documento', 'Foto do local', 'Comprovante de repasse', 'Outro')),
  created_at timestamp with time zone not null default now()
);

create index if not exists partner_commissions_owner_idx on public.partner_commissions(owner_user_id, status, created_at desc);
create index if not exists partner_commissions_partner_idx on public.partner_commissions(partner_id, status, created_at desc);
create index if not exists lead_files_lead_created_idx on public.lead_files(lead_id, created_at desc);

create or replace function public.set_partner_commission_amount()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.commission_rate := 0.0500;
  new.commission_amount := round(new.sale_amount * new.commission_rate, 2);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists partner_commissions_set_amount on public.partner_commissions;
create trigger partner_commissions_set_amount
before insert or update of sale_amount on public.partner_commissions
for each row execute function public.set_partner_commission_amount();

alter table public.partner_commissions enable row level security;
alter table public.lead_files enable row level security;

drop policy if exists "partner_commissions_select_authorized" on public.partner_commissions;
create policy "partner_commissions_select_authorized" on public.partner_commissions
for select using (
  public.current_profile_is_active()
  and (auth.uid() = owner_user_id or auth.uid() = partner_id or public.is_admin())
);

create or replace function public.can_access_lead_file(target_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_is_active()
    and exists (
      select 1
      from public.leads l
      where l.id = target_lead_id
        and (l.user_id = auth.uid() or l.partner_id = auth.uid() or public.is_admin())
    );
$$;

drop policy if exists "lead_files_select_authorized" on public.lead_files;
drop policy if exists "lead_files_insert_authorized" on public.lead_files;
drop policy if exists "lead_files_delete_uploader_or_owner" on public.lead_files;
create policy "lead_files_select_authorized" on public.lead_files
for select using (public.can_access_lead_file(lead_id));
create policy "lead_files_insert_authorized" on public.lead_files
for insert with check (auth.uid() = user_id and public.can_access_lead_file(lead_id));
create policy "lead_files_delete_uploader_or_owner" on public.lead_files
for delete using (
  auth.uid() = user_id
  or exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-files',
  'lead-files',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lead_files_storage_insert_own_folder" on storage.objects;
drop policy if exists "lead_files_storage_select_authorized" on storage.objects;
drop policy if exists "lead_files_storage_delete_authorized" on storage.objects;
create policy "lead_files_storage_insert_own_folder" on storage.objects
for insert to authenticated with check (
  bucket_id = 'lead-files'
  and public.current_profile_is_active()
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "lead_files_storage_select_authorized" on storage.objects
for select to authenticated using (
  bucket_id = 'lead-files'
  and exists (
    select 1 from public.lead_files f
    where f.storage_path = name and public.can_access_lead_file(f.lead_id)
  )
);
create policy "lead_files_storage_delete_authorized" on storage.objects
for delete to authenticated using (
  bucket_id = 'lead-files'
  and exists (
    select 1
    from public.lead_files f
    join public.leads l on l.id = f.lead_id
    where f.storage_path = name
      and (f.user_id = auth.uid() or l.user_id = auth.uid() or public.is_admin())
  )
);

create or replace function public.partner_update_visit_feedback(
  target_lead_id uuid,
  new_visit_status text,
  new_partner_notes text,
  new_partner_visit_feedback text
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_lead public.leads;
  effective_feedback text;
begin
  if auth.uid() is null or not public.current_profile_is_active() or public.current_profile_role() <> 'partner' then
    raise exception 'Somente o parceiro ativo pode registrar o retorno da visita';
  end if;

  select coalesce(nullif(trim(new_partner_visit_feedback), ''), partner_visit_feedback)
  into effective_feedback
  from public.leads
  where id = target_lead_id and partner_id = auth.uid();

  if not found then
    raise exception 'Lead nao encontrado ou nao atribuido ao parceiro logado';
  end if;

  if new_visit_status = 'Visita realizada' and nullif(trim(coalesce(effective_feedback, '')), '') is null then
    raise exception 'Informe o resumo final antes de concluir a visita';
  end if;

  update public.leads
  set visit_status = coalesce(nullif(trim(new_visit_status), ''), visit_status),
      partner_notes = nullif(trim(new_partner_notes), ''),
      partner_visit_feedback = nullif(trim(new_partner_visit_feedback), ''),
      updated_at = now()
  where id = target_lead_id and partner_id = auth.uid()
  returning * into updated_lead;

  return updated_lead;
end;
$$;

create or replace function public.notify_lead_owner_partner_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_type text;
  notification_title text;
begin
  if auth.uid() is distinct from new.partner_id
    or new.user_id is null
    or new.user_id = new.partner_id
    or (
      new.visit_status is not distinct from old.visit_status
      and new.partner_notes is not distinct from old.partner_notes
      and new.partner_visit_feedback is not distinct from old.partner_visit_feedback
    ) then
    return new;
  end if;

  if new.visit_status = 'Visita realizada' and old.visit_status is distinct from new.visit_status then
    notification_type := 'partner_visit_completed';
    notification_title := 'Visita concluida pelo parceiro';
  else
    notification_type := 'partner_visit_reported';
    notification_title := 'Atualizacao de visita do parceiro';
  end if;

  insert into public.partner_notifications (user_id, lead_id, type, title, body)
  values (
    new.user_id,
    new.id,
    notification_type,
    notification_title,
    concat('O parceiro atualizou a visita de ', new.name, '. Revise o retorno na ficha do lead.')
  );
  return new;
end;
$$;

drop trigger if exists leads_notify_owner_partner_feedback on public.leads;
drop trigger if exists leads_notify_owner_partner_activity on public.leads;
create trigger leads_notify_owner_partner_activity
after update of visit_status, partner_notes, partner_visit_feedback on public.leads
for each row execute function public.notify_lead_owner_partner_activity();

create or replace function public.partner_submit_sale_commission(
  target_lead_id uuid,
  reported_sale_amount numeric,
  reported_sale_closed_at date,
  reported_transfer_due_date date default null,
  reported_transfer_reference text default null
)
returns public.partner_commissions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_lead public.leads;
  saved_commission public.partner_commissions;
  next_status text;
begin
  if auth.uid() is null or not public.current_profile_is_active() or public.current_profile_role() <> 'partner' then
    raise exception 'Somente o parceiro ativo pode registrar um fechamento';
  end if;
  if reported_sale_amount is null or reported_sale_amount <= 0 then
    raise exception 'Informe um valor de venda valido';
  end if;
  if reported_sale_closed_at is null then
    raise exception 'Informe a data do fechamento';
  end if;

  select * into target_lead
  from public.leads
  where id = target_lead_id and partner_id = auth.uid();

  if not found then
    raise exception 'Lead nao encontrado ou nao atribuido ao parceiro logado';
  end if;

  next_status := case when nullif(trim(coalesce(reported_transfer_reference, '')), '') is null
    then 'awaiting_transfer' else 'transfer_reported' end;

  insert into public.partner_commissions (
    lead_id, owner_user_id, partner_id, sale_amount, commission_rate, commission_amount,
    sale_closed_at, transfer_due_date, transfer_reference, status, reported_at
  ) values (
    target_lead.id, target_lead.user_id, auth.uid(), reported_sale_amount, 0.0500, round(reported_sale_amount * 0.05, 2),
    reported_sale_closed_at, reported_transfer_due_date, nullif(trim(reported_transfer_reference), ''), next_status, now()
  )
  on conflict (lead_id) do update set
    sale_amount = excluded.sale_amount,
    sale_closed_at = excluded.sale_closed_at,
    transfer_due_date = excluded.transfer_due_date,
    transfer_reference = excluded.transfer_reference,
    status = case when public.partner_commissions.status = 'confirmed' then 'confirmed' else excluded.status end,
    reported_at = now()
  where public.partner_commissions.partner_id = auth.uid()
    and public.partner_commissions.status <> 'confirmed'
  returning * into saved_commission;

  if saved_commission.id is null then
    raise exception 'O repasse ja foi confirmado e nao pode ser alterado pelo parceiro';
  end if;

  update public.leads
  set status = 'Fechado', updated_at = now()
  where id = target_lead.id;

  return saved_commission;
end;
$$;

create or replace function public.admin_confirm_partner_commission(target_commission_id uuid)
returns public.partner_commissions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_commission public.partner_commissions;
begin
  if auth.uid() is null or not public.current_profile_is_active() or not public.is_admin() then
    raise exception 'Somente um administrador ativo pode confirmar o repasse';
  end if;

  update public.partner_commissions
  set status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid(), updated_at = now()
  where id = target_commission_id and status <> 'confirmed'
  returning * into saved_commission;

  if saved_commission.id is null then
    raise exception 'Repasse nao encontrado ou ja confirmado';
  end if;
  return saved_commission;
end;
$$;

create or replace function public.notify_partner_commission_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_name text;
begin
  select name into lead_name from public.leads where id = new.lead_id;

  if tg_op = 'INSERT' then
    insert into public.partner_notifications (user_id, lead_id, type, title, body)
    values (new.owner_user_id, new.lead_id, 'partner_sale_reported', 'Fechamento informado pelo parceiro', concat('Revise o fechamento e o repasse de 5% do lead ', coalesce(lead_name, 'atribuido'), '.'));
  elsif old.status is distinct from new.status and new.status = 'transfer_reported' then
    insert into public.partner_notifications (user_id, lead_id, type, title, body)
    values (new.owner_user_id, new.lead_id, 'partner_transfer_reported', 'Repasse informado pelo parceiro', concat('O parceiro informou o repasse referente a ', coalesce(lead_name, 'um lead'), '. Confirme o recebimento.'));
  elsif old.status is distinct from new.status and new.status = 'confirmed' then
    insert into public.partner_notifications (user_id, lead_id, type, title, body)
    values (new.partner_id, new.lead_id, 'partner_transfer_confirmed', 'Repasse confirmado', concat('O repasse de 5% do lead ', coalesce(lead_name, 'atribuido'), ' foi confirmado.'));
  end if;
  return new;
end;
$$;

drop trigger if exists partner_commissions_notify_activity on public.partner_commissions;
create trigger partner_commissions_notify_activity
after insert or update of status on public.partner_commissions
for each row execute function public.notify_partner_commission_activity();

alter table public.partner_notifications drop constraint if exists partner_notifications_type_check;
alter table public.partner_notifications add constraint partner_notifications_type_check
check (type in (
  'visit_briefing_assigned', 'visit_briefing_updated', 'visit_assigned', 'visit_rescheduled',
  'visit_status_updated', 'feedback_requested', 'deadline_approaching', 'partner_feedback_received',
  'partner_visit_reported', 'partner_visit_completed', 'partner_sale_reported',
  'partner_transfer_reported', 'partner_transfer_confirmed'
)) not valid;

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
    case
      when new.lead_id is null then '/partner'
      when new.type in ('partner_visit_reported', 'partner_visit_completed', 'partner_sale_reported', 'partner_transfer_reported', 'partner_transfer_confirmed') then concat('/leads/', new.lead_id::text)
      else concat('/leads/', new.lead_id::text, '/briefing')
    end
  )
  on conflict (notification_id) do nothing;
  return new;
end;
$$;

grant select, insert, delete on table public.lead_files to authenticated;
grant select on table public.partner_commissions to authenticated;
grant execute on function public.partner_update_visit_feedback(uuid, text, text, text) to authenticated;
grant execute on function public.partner_submit_sale_commission(uuid, numeric, date, date, text) to authenticated;
grant execute on function public.admin_confirm_partner_commission(uuid) to authenticated;
