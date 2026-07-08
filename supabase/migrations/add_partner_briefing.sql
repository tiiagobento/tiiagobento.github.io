alter table public.profiles
  add column if not exists role text default 'user';

alter table public.leads
  add column if not exists partner_id uuid references public.profiles(id),
  add column if not exists partner_name text,
  add column if not exists visit_scheduled_at timestamp with time zone,
  add column if not exists visit_status text default 'Aguardando agendamento',
  add column if not exists partner_notes text,
  add column if not exists partner_visit_feedback text;

create index if not exists leads_partner_visit_idx on public.leads(partner_id, visit_scheduled_at);

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'user');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'admin';
$$;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;

create policy "profiles_select_self_or_admin" on public.profiles
for select using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own_or_admin" on public.profiles
for update using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists "leads_select_own" on public.leads;
drop policy if exists "leads_insert_own" on public.leads;
drop policy if exists "leads_update_own" on public.leads;
drop policy if exists "leads_delete_own" on public.leads;
drop policy if exists "leads_select_owner_or_partner" on public.leads;
drop policy if exists "leads_insert_owner" on public.leads;
drop policy if exists "leads_update_owner" on public.leads;
drop policy if exists "leads_delete_owner" on public.leads;

create policy "leads_select_owner_or_partner" on public.leads
for select using (auth.uid() = user_id or auth.uid() = partner_id or public.is_admin());

create policy "leads_insert_owner" on public.leads
for insert with check (auth.uid() = user_id or public.is_admin());

create policy "leads_update_owner" on public.leads
for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

create policy "leads_delete_owner" on public.leads
for delete using (auth.uid() = user_id or public.is_admin());

drop policy if exists "interactions_select_own_leads" on public.interactions;
drop policy if exists "interactions_insert_own_leads" on public.interactions;
drop policy if exists "interactions_update_own_leads" on public.interactions;
drop policy if exists "interactions_delete_own_leads" on public.interactions;
drop policy if exists "interactions_select_owner_or_partner_leads" on public.interactions;
drop policy if exists "interactions_insert_owner_leads" on public.interactions;
drop policy if exists "interactions_update_owner_leads" on public.interactions;
drop policy if exists "interactions_delete_owner_leads" on public.interactions;

create policy "interactions_select_owner_or_partner_leads" on public.interactions
for select using (
  exists (
    select 1 from public.leads l
    where l.id = lead_id and (l.user_id = auth.uid() or l.partner_id = auth.uid() or public.is_admin())
  )
);

create policy "interactions_insert_owner_leads" on public.interactions
for insert with check (
  (auth.uid() = user_id or public.is_admin())
  and exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin()))
);

create policy "interactions_update_owner_leads" on public.interactions
for update using (
  (auth.uid() = user_id or public.is_admin())
  and exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin()))
)
with check (
  (auth.uid() = user_id or public.is_admin())
  and exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin()))
);

create policy "interactions_delete_owner_leads" on public.interactions
for delete using (
  (auth.uid() = user_id or public.is_admin())
  and exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin()))
);

drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;
drop policy if exists "tasks_select_owner_or_partner" on public.tasks;
drop policy if exists "tasks_insert_owner" on public.tasks;
drop policy if exists "tasks_update_owner" on public.tasks;
drop policy if exists "tasks_delete_owner" on public.tasks;

create policy "tasks_select_owner_or_partner" on public.tasks
for select using (
  auth.uid() = user_id
  or exists (select 1 from public.leads l where l.id = lead_id and l.partner_id = auth.uid())
  or public.is_admin()
);

create policy "tasks_insert_owner" on public.tasks
for insert with check (
  (auth.uid() = user_id or public.is_admin())
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin())))
);

create policy "tasks_update_owner" on public.tasks
for update using (
  (auth.uid() = user_id or public.is_admin())
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin())))
)
with check (
  (auth.uid() = user_id or public.is_admin())
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin())))
);

create policy "tasks_delete_owner" on public.tasks
for delete using (
  (auth.uid() = user_id or public.is_admin())
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin())))
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
begin
  if public.current_profile_role() <> 'partner' then
    raise exception 'Apenas parceiro pode registrar retorno por esta funcao';
  end if;

  update public.leads
  set
    visit_status = coalesce(nullif(new_visit_status, ''), visit_status),
    partner_notes = new_partner_notes,
    partner_visit_feedback = new_partner_visit_feedback,
    updated_at = now()
  where id = target_lead_id
    and partner_id = auth.uid()
  returning * into updated_lead;

  if updated_lead.id is null then
    raise exception 'Lead nao encontrado ou nao atribuido ao parceiro logado';
  end if;

  return updated_lead;
end;
$$;

grant execute on function public.partner_update_visit_feedback(uuid, text, text, text) to authenticated;
