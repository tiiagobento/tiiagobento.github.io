-- Nova Forma CRM: versioned technical rules for Steel Frame estimates.
-- Non-destructive and idempotent. This migration creates no approved rule or
-- structural threshold: only an authenticated technical approver can approve a
-- configured draft after the company has supplied licensed references and data.

create extension if not exists pgcrypto;

create table if not exists public.steel_frame_technical_rules (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  code text not null,
  version text not null,
  name text not null,
  rule_type text not null,
  origin text not null check (origin in ('standard', 'manufacturer', 'company', 'technical_responsible')),
  reference_name text not null,
  reference_version text not null,
  permitted_use text,
  application_scope jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  parameters jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  technical_responsible_name text,
  technical_responsible_registration text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded', 'archived')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamp with time zone,
  approval_notes text,
  effective_from date,
  effective_to date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (code, version),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create table if not exists public.steel_frame_technical_compositions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  code text not null,
  version text not null,
  name text not null,
  application_type text not null check (application_type in ('structural', 'non_structural', 'floor', 'roof', 'other')),
  profile_specification text,
  description text,
  permitted_use text,
  application_scope jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  technical_responsible_name text,
  technical_responsible_registration text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded', 'archived')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamp with time zone,
  approval_notes text,
  effective_from date,
  effective_to date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (code, version),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create table if not exists public.steel_frame_technical_composition_rules (
  id uuid primary key default gen_random_uuid(),
  composition_id uuid not null references public.steel_frame_technical_compositions(id) on delete cascade,
  rule_id uuid not null references public.steel_frame_technical_rules(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  unique (composition_id, rule_id)
);

create table if not exists public.steel_frame_technical_assessments (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  composition_id uuid references public.steel_frame_technical_compositions(id) on delete set null,
  classification text not null check (classification in ('automatic', 'preliminary', 'technical_review_required')),
  input_snapshot jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  rule_snapshot jsonb not null default '[]'::jsonb,
  assessed_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamp with time zone not null default now()
);

create index if not exists steel_frame_technical_rules_status_idx
  on public.steel_frame_technical_rules(status, updated_at desc);
create index if not exists steel_frame_technical_compositions_status_idx
  on public.steel_frame_technical_compositions(status, updated_at desc);
create index if not exists steel_frame_technical_composition_rules_composition_idx
  on public.steel_frame_technical_composition_rules(composition_id, sort_order);
create index if not exists steel_frame_technical_assessments_estimate_idx
  on public.steel_frame_technical_assessments(estimate_id, created_at desc);

create or replace function public.can_approve_steel_frame_technical_catalog()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_is_active()
    and (
      public.has_permission('estimates.manage_all')
      or public.has_permission('estimates.approve')
    );
$$;

create or replace function public.guard_steel_frame_technical_artifact_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Modelos e regras tecnicas devem ser criados como rascunho.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Artefatos tecnicos aprovados, superados ou arquivados nao podem ser excluidos.';
    end if;
    return old;
  end if;

  if old.status = 'approved' then
    if new.status not in ('superseded', 'archived')
      or (to_jsonb(new) - 'updated_at' - 'status') is distinct from (to_jsonb(old) - 'updated_at' - 'status') then
      raise exception 'Um artefato tecnico aprovado nao pode ser alterado. Crie uma nova versao.';
    end if;
    if not public.can_approve_steel_frame_technical_catalog() then
      raise exception 'Permissao insuficiente para encerrar uma versao tecnica aprovada.';
    end if;
    return new;
  end if;

  if new.status = 'approved' then
    if not public.can_approve_steel_frame_technical_catalog() then
      raise exception 'Permissao insuficiente para aprovar o catalogo tecnico.';
    end if;
    if nullif(trim(coalesce(new.technical_responsible_name, '')), '') is null
      or nullif(trim(coalesce(new.technical_responsible_registration, '')), '') is null then
      raise exception 'Informe responsavel tecnico e registro antes de aprovar.';
    end if;
    if new.effective_from is null then
      raise exception 'Informe a data de inicio da vigencia antes de aprovar.';
    end if;
    if tg_table_name = 'steel_frame_technical_rules' then
      if nullif(trim(coalesce(new.reference_name, '')), '') is null
        or nullif(trim(coalesce(new.reference_version, '')), '') is null then
        raise exception 'Informe fonte e versao antes de aprovar uma regra tecnica.';
      end if;
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.guard_steel_frame_technical_composition_rule_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_composition_id uuid;
  target_status text;
begin
  target_composition_id := case when tg_op = 'DELETE' then old.composition_id else new.composition_id end;
  select status into target_status
  from public.steel_frame_technical_compositions
  where id = target_composition_id;

  if target_status is null then
    raise exception 'Composicao tecnica nao encontrada.';
  end if;
  if target_status <> 'draft' then
    raise exception 'As regras de uma composicao aprovada nao podem ser alteradas. Crie uma nova versao.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.approve_steel_frame_technical_rule(target_rule_id uuid, review_notes text default null)
returns public.steel_frame_technical_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  rule_row public.steel_frame_technical_rules%rowtype;
begin
  if not public.can_approve_steel_frame_technical_catalog() then
    raise exception 'Permissao insuficiente para aprovar o catalogo tecnico.';
  end if;
  select * into rule_row from public.steel_frame_technical_rules where id = target_rule_id for update;
  if not found then raise exception 'Regra tecnica nao encontrada.'; end if;
  if rule_row.status <> 'draft' then raise exception 'Somente regras em rascunho podem ser aprovadas.'; end if;
  update public.steel_frame_technical_rules
  set status = 'approved', approval_notes = nullif(trim(coalesce(review_notes, '')), '')
  where id = target_rule_id
  returning * into rule_row;
  return rule_row;
end;
$$;

create or replace function public.approve_steel_frame_technical_composition(target_composition_id uuid, review_notes text default null)
returns public.steel_frame_technical_compositions
language plpgsql
security definer
set search_path = public
as $$
declare
  composition_row public.steel_frame_technical_compositions%rowtype;
  unapproved_rule_count integer;
begin
  if not public.can_approve_steel_frame_technical_catalog() then
    raise exception 'Permissao insuficiente para aprovar o catalogo tecnico.';
  end if;
  select * into composition_row from public.steel_frame_technical_compositions where id = target_composition_id for update;
  if not found then raise exception 'Composicao tecnica nao encontrada.'; end if;
  if composition_row.status <> 'draft' then raise exception 'Somente composicoes em rascunho podem ser aprovadas.'; end if;

  select count(*) into unapproved_rule_count
  from public.steel_frame_technical_composition_rules link
  join public.steel_frame_technical_rules rule_row on rule_row.id = link.rule_id
  where link.composition_id = target_composition_id
    and rule_row.status <> 'approved';
  if unapproved_rule_count > 0 then
    raise exception 'A composicao so pode ser aprovada com regras tecnicas aprovadas.';
  end if;
  if not exists (select 1 from public.steel_frame_technical_composition_rules where composition_id = target_composition_id) then
    raise exception 'Vincule ao menos uma regra tecnica aprovada antes de aprovar a composicao.';
  end if;

  update public.steel_frame_technical_compositions
  set status = 'approved', approval_notes = nullif(trim(coalesce(review_notes, '')), '')
  where id = target_composition_id
  returning * into composition_row;
  return composition_row;
end;
$$;

drop trigger if exists steel_frame_technical_rules_updated_at on public.steel_frame_technical_rules;
create trigger steel_frame_technical_rules_updated_at
before update on public.steel_frame_technical_rules
for each row execute function public.set_steel_frame_updated_at();
drop trigger if exists steel_frame_technical_rules_guard on public.steel_frame_technical_rules;
create trigger steel_frame_technical_rules_guard
before insert or update or delete on public.steel_frame_technical_rules
for each row execute function public.guard_steel_frame_technical_artifact_mutation();

drop trigger if exists steel_frame_technical_compositions_updated_at on public.steel_frame_technical_compositions;
create trigger steel_frame_technical_compositions_updated_at
before update on public.steel_frame_technical_compositions
for each row execute function public.set_steel_frame_updated_at();
drop trigger if exists steel_frame_technical_compositions_guard on public.steel_frame_technical_compositions;
create trigger steel_frame_technical_compositions_guard
before insert or update or delete on public.steel_frame_technical_compositions
for each row execute function public.guard_steel_frame_technical_artifact_mutation();

drop trigger if exists steel_frame_technical_composition_rules_guard on public.steel_frame_technical_composition_rules;
create trigger steel_frame_technical_composition_rules_guard
before insert or update or delete on public.steel_frame_technical_composition_rules
for each row execute function public.guard_steel_frame_technical_composition_rule_mutation();

alter table public.steel_frame_technical_rules enable row level security;
alter table public.steel_frame_technical_compositions enable row level security;
alter table public.steel_frame_technical_composition_rules enable row level security;
alter table public.steel_frame_technical_assessments enable row level security;

drop policy if exists "steel_frame_technical_rules_select_authorized" on public.steel_frame_technical_rules;
drop policy if exists "steel_frame_technical_rules_insert_authorized" on public.steel_frame_technical_rules;
drop policy if exists "steel_frame_technical_rules_update_authorized" on public.steel_frame_technical_rules;
drop policy if exists "steel_frame_technical_rules_delete_authorized" on public.steel_frame_technical_rules;
create policy "steel_frame_technical_rules_select_authorized" on public.steel_frame_technical_rules
for select using (public.can_manage_steel_frame_catalog() or (status = 'approved' and public.can_view_steel_frame_catalog()));
create policy "steel_frame_technical_rules_insert_authorized" on public.steel_frame_technical_rules
for insert with check (public.can_manage_steel_frame_catalog() and created_by = auth.uid());
create policy "steel_frame_technical_rules_update_authorized" on public.steel_frame_technical_rules
for update using (public.can_manage_steel_frame_catalog()) with check (public.can_manage_steel_frame_catalog());
create policy "steel_frame_technical_rules_delete_authorized" on public.steel_frame_technical_rules
for delete using (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_technical_compositions_select_authorized" on public.steel_frame_technical_compositions;
drop policy if exists "steel_frame_technical_compositions_insert_authorized" on public.steel_frame_technical_compositions;
drop policy if exists "steel_frame_technical_compositions_update_authorized" on public.steel_frame_technical_compositions;
drop policy if exists "steel_frame_technical_compositions_delete_authorized" on public.steel_frame_technical_compositions;
create policy "steel_frame_technical_compositions_select_authorized" on public.steel_frame_technical_compositions
for select using (public.can_manage_steel_frame_catalog() or (status = 'approved' and public.can_view_steel_frame_catalog()));
create policy "steel_frame_technical_compositions_insert_authorized" on public.steel_frame_technical_compositions
for insert with check (public.can_manage_steel_frame_catalog() and created_by = auth.uid());
create policy "steel_frame_technical_compositions_update_authorized" on public.steel_frame_technical_compositions
for update using (public.can_manage_steel_frame_catalog()) with check (public.can_manage_steel_frame_catalog());
create policy "steel_frame_technical_compositions_delete_authorized" on public.steel_frame_technical_compositions
for delete using (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_technical_composition_rules_select_authorized" on public.steel_frame_technical_composition_rules;
drop policy if exists "steel_frame_technical_composition_rules_mutate_authorized" on public.steel_frame_technical_composition_rules;
create policy "steel_frame_technical_composition_rules_select_authorized" on public.steel_frame_technical_composition_rules
for select using (
  exists (
    select 1 from public.steel_frame_technical_compositions composition_row
    where composition_row.id = composition_id
      and (public.can_manage_steel_frame_catalog() or (composition_row.status = 'approved' and public.can_view_steel_frame_catalog()))
  )
);
create policy "steel_frame_technical_composition_rules_mutate_authorized" on public.steel_frame_technical_composition_rules
for all using (public.can_manage_steel_frame_catalog()) with check (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_technical_assessments_select_authorized" on public.steel_frame_technical_assessments;
drop policy if exists "steel_frame_technical_assessments_insert_authorized" on public.steel_frame_technical_assessments;
create policy "steel_frame_technical_assessments_select_authorized" on public.steel_frame_technical_assessments
for select using (public.can_access_steel_frame_estimate(estimate_id));
create policy "steel_frame_technical_assessments_insert_authorized" on public.steel_frame_technical_assessments
for insert with check (assessed_by = auth.uid() and public.can_edit_steel_frame_estimate(estimate_id));

grant select, insert, update, delete on public.steel_frame_technical_rules to authenticated;
grant select, insert, update, delete on public.steel_frame_technical_compositions to authenticated;
grant select, insert, update, delete on public.steel_frame_technical_composition_rules to authenticated;
grant select, insert on public.steel_frame_technical_assessments to authenticated;
grant execute on function public.can_approve_steel_frame_technical_catalog() to authenticated;
grant execute on function public.approve_steel_frame_technical_rule(uuid, text) to authenticated;
grant execute on function public.approve_steel_frame_technical_composition(uuid, text) to authenticated;
revoke all on function public.can_approve_steel_frame_technical_catalog() from public;
revoke all on function public.approve_steel_frame_technical_rule(uuid, text) from public;
revoke all on function public.approve_steel_frame_technical_composition(uuid, text) from public;
revoke all on function public.guard_steel_frame_technical_artifact_mutation() from public;
revoke all on function public.guard_steel_frame_technical_composition_rule_mutation() from public;
