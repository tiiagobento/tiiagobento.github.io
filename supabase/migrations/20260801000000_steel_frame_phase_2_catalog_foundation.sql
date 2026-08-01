-- Nova Forma CRM: Phase 2 Steel Frame catalog foundation.
--
-- This migration is additive and must be applied only after the existing Steel
-- Frame baseline and its authenticated preflight have passed in a confirmed
-- homologation project. It creates no approved technical rule, composition,
-- coefficient, material variation, or reinforcement template.
--
-- Do not apply this file to production until the Phase 2 validation plan is
-- approved. It does not delete CRM data, tables, or business records.

do $$
declare
  required_relation text;
begin
  foreach required_relation in array array[
    'profiles',
    'permissions',
    'role_permissions',
    'steel_frame_estimates',
    'steel_frame_estimate_versions',
    'steel_frame_materials',
    'steel_frame_suppliers',
    'steel_frame_material_prices',
    'steel_frame_reinforcement_templates',
    'steel_frame_technical_rules',
    'steel_frame_technical_compositions',
    'steel_frame_technical_composition_rules',
    'steel_frame_technical_assessments'
  ] loop
    if to_regclass(format('public.%I', required_relation)) is null then
      raise exception
        'Phase 2 baseline is incomplete: public.% is missing. Run the authenticated preflight and apply the approved baseline migrations first.',
        required_relation;
    end if;
  end loop;

  if to_regprocedure('public.has_permission(text)') is null
    or to_regprocedure('public.can_view_steel_frame_catalog()') is null
    or to_regprocedure('public.can_manage_steel_frame_catalog()') is null
    or to_regprocedure('public.can_access_steel_frame_estimate(uuid)') is null
    or to_regprocedure('public.can_edit_steel_frame_estimate(uuid)') is null
    or to_regprocedure('public.can_read_steel_frame_financials(uuid)') is null
    or to_regprocedure('public.set_steel_frame_updated_at()') is null then
    raise exception 'Phase 2 baseline is incomplete: required authorization or timestamp functions are missing.';
  end if;
end;
$$;

create extension if not exists pgcrypto;

create table if not exists public.steel_frame_technical_sources (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  title text not null,
  source_type text not null check (source_type in (
    'standard', 'guideline', 'manual', 'technical_sheet', 'catalog',
    'structural_project', 'memorial', 'approved_composition',
    'internal_guidance', 'installer_validated_method', 'supplier_quote',
    'price_table', 'calibration_case'
  )),
  code text,
  issuer text,
  manufacturer text,
  product_name text,
  edition text,
  revision text,
  published_on date,
  effective_from date,
  effective_to date,
  source_url text,
  content_sha256 text,
  permitted_use text,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'pending_validation', 'approved', 'deprecated', 'archived')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamp with time zone,
  approval_notes text,
  deprecated_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from),
  check (content_sha256 is null or content_sha256 ~ '^[A-Fa-f0-9]{64}$')
);

create table if not exists public.steel_frame_technical_source_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.steel_frame_technical_sources(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  original_file_name text not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 20971520),
  page_count integer check (page_count > 0),
  content_sha256 text,
  visibility text not null default 'restricted' check (visibility in ('catalog', 'restricted')),
  notes text,
  status text not null default 'draft' check (status in ('draft', 'pending_validation', 'approved', 'deprecated', 'archived')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamp with time zone,
  approval_notes text,
  deprecated_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  check (content_sha256 is null or content_sha256 ~ '^[A-Fa-f0-9]{64}$')
);

create table if not exists public.steel_frame_material_variants (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.steel_frame_materials(id) on delete restrict,
  supplier_id uuid references public.steel_frame_suppliers(id) on delete set null,
  source_id uuid references public.steel_frame_technical_sources(id) on delete restrict,
  source_document_id uuid references public.steel_frame_technical_source_documents(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  sku text,
  name text not null,
  manufacturer text,
  technical_unit text not null,
  purchase_unit text not null,
  thickness_millimeters numeric(10,3) check (thickness_millimeters > 0),
  length_millimeters numeric(12,3) check (length_millimeters > 0),
  width_millimeters numeric(12,3) check (width_millimeters > 0),
  coverage_per_purchase_unit numeric(14,4) check (coverage_per_purchase_unit > 0),
  package_content jsonb not null default '{}'::jsonb,
  specification jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'pending_validation', 'approved', 'deprecated', 'archived')),
  version text not null default '1.0',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamp with time zone,
  approval_notes text,
  deprecated_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique nulls not distinct (material_id, supplier_id, sku, version),
  check (jsonb_typeof(package_content) = 'object'),
  check (jsonb_typeof(specification) = 'object')
);

create table if not exists public.steel_frame_material_coefficients (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.steel_frame_materials(id) on delete restrict,
  material_variant_id uuid references public.steel_frame_material_variants(id) on delete restrict,
  composition_id uuid references public.steel_frame_technical_compositions(id) on delete restrict,
  source_id uuid references public.steel_frame_technical_sources(id) on delete restrict,
  source_document_id uuid references public.steel_frame_technical_source_documents(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  code text not null,
  version text not null,
  name text not null,
  consumption_type text not null check (consumption_type in (
    'per_square_meter', 'per_joint_meter', 'per_perimeter_meter',
    'per_board', 'per_layer', 'per_package', 'per_opening', 'manual'
  )),
  amount numeric(14,6) not null check (amount >= 0),
  input_unit text not null,
  output_unit text not null,
  layer_count integer check (layer_count > 0),
  conditions jsonb not null default '{}'::jsonb,
  page_reference text,
  notes text,
  effective_from date,
  effective_to date,
  status text not null default 'draft' check (status in ('draft', 'pending_validation', 'approved', 'deprecated', 'archived')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamp with time zone,
  approval_notes text,
  deprecated_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (material_id, code, version),
  check (effective_to is null or effective_from is null or effective_to >= effective_from),
  check (jsonb_typeof(conditions) = 'object')
);

create table if not exists public.steel_frame_material_compatibilities (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.steel_frame_materials(id) on delete restrict,
  material_variant_id uuid references public.steel_frame_material_variants(id) on delete restrict,
  related_material_id uuid references public.steel_frame_materials(id) on delete restrict,
  related_material_variant_id uuid references public.steel_frame_material_variants(id) on delete restrict,
  source_id uuid references public.steel_frame_technical_sources(id) on delete restrict,
  source_document_id uuid references public.steel_frame_technical_source_documents(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  relationship_type text not null check (relationship_type in ('requires', 'allows', 'excludes', 'replaces')),
  conditions jsonb not null default '{}'::jsonb,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'pending_validation', 'approved', 'deprecated', 'archived')),
  version text not null default '1.0',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamp with time zone,
  approval_notes text,
  deprecated_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  check (material_id is not null or material_variant_id is not null),
  check (related_material_id is not null or related_material_variant_id is not null),
  check (jsonb_typeof(conditions) = 'object')
);

alter table public.steel_frame_technical_rules
  add column if not exists strategy_type text,
  add column if not exists parameter_schema_version integer,
  add column if not exists technical_input_unit text,
  add column if not exists purchase_unit text,
  add column if not exists source_id uuid references public.steel_frame_technical_sources(id) on delete restrict,
  add column if not exists source_document_id uuid references public.steel_frame_technical_source_documents(id) on delete restrict,
  add column if not exists deprecated_at timestamp with time zone,
  add column if not exists supersedes_rule_id uuid references public.steel_frame_technical_rules(id) on delete restrict;

alter table public.steel_frame_technical_compositions
  add column if not exists source_id uuid references public.steel_frame_technical_sources(id) on delete restrict,
  add column if not exists source_document_id uuid references public.steel_frame_technical_source_documents(id) on delete restrict,
  add column if not exists wall_use text check (wall_use in ('structural', 'non_structural', 'mixed')),
  add column if not exists exposure text check (exposure in ('interior', 'exterior', 'protected', 'exposed')),
  add column if not exists environment_condition text check (environment_condition in ('dry', 'wet', 'exposed', 'mixed')),
  add column if not exists min_wall_height_meters numeric(10,3) check (min_wall_height_meters > 0),
  add column if not exists max_wall_height_meters numeric(10,3) check (max_wall_height_meters > 0),
  add column if not exists max_floors integer check (max_floors > 0),
  add column if not exists max_opening_width_meters numeric(10,3) check (max_opening_width_meters > 0),
  add column if not exists deprecated_at timestamp with time zone,
  add column if not exists supersedes_composition_id uuid references public.steel_frame_technical_compositions(id) on delete restrict;

alter table public.steel_frame_reinforcement_templates
  add column if not exists code text,
  add column if not exists version text not null default '1.0',
  add column if not exists source_id uuid references public.steel_frame_technical_sources(id) on delete restrict,
  add column if not exists source_document_id uuid references public.steel_frame_technical_source_documents(id) on delete restrict,
  add column if not exists status text not null default 'draft' check (status in ('draft', 'pending_validation', 'approved', 'deprecated', 'archived')),
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamp with time zone,
  add column if not exists approval_notes text,
  add column if not exists deprecated_at timestamp with time zone,
  add column if not exists supersedes_template_id uuid references public.steel_frame_reinforcement_templates(id) on delete restrict;

alter table public.steel_frame_material_prices
  add column if not exists material_variant_id uuid references public.steel_frame_material_variants(id) on delete restrict,
  add column if not exists source_document_id uuid references public.steel_frame_technical_source_documents(id) on delete set null,
  add column if not exists quote_number text,
  add column if not exists freight_amount numeric(14,2) check (freight_amount is null or freight_amount >= 0),
  add column if not exists payment_terms text,
  add column if not exists preferred boolean not null default false;

create table if not exists public.steel_frame_technical_composition_layers (
  id uuid primary key default gen_random_uuid(),
  composition_id uuid not null references public.steel_frame_technical_compositions(id) on delete cascade,
  material_id uuid references public.steel_frame_materials(id) on delete restrict,
  material_variant_id uuid references public.steel_frame_material_variants(id) on delete restrict,
  coefficient_id uuid references public.steel_frame_material_coefficients(id) on delete restrict,
  technical_rule_id uuid references public.steel_frame_technical_rules(id) on delete restrict,
  source_id uuid references public.steel_frame_technical_sources(id) on delete restrict,
  source_document_id uuid references public.steel_frame_technical_source_documents(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  position text not null,
  material_family text not null,
  faces integer not null default 1 check (faces > 0 and faces <= 4),
  layer_count integer not null default 1 check (layer_count > 0 and layer_count <= 12),
  waste_percent numeric(6,3) not null default 0 check (waste_percent >= 0 and waste_percent <= 100),
  rounding_mode text not null default 'ceil' check (rounding_mode in ('none', 'ceil', 'floor', 'nearest')),
  rounding_multiple numeric(12,4) not null default 1 check (rounding_multiple > 0),
  required boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  notes text,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  check (material_id is not null or material_variant_id is not null or technical_rule_id is not null),
  check (jsonb_typeof(conditions) = 'object')
);

create table if not exists public.steel_frame_estimate_scenarios (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  geometry_source_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  base_scenario_id uuid references public.steel_frame_estimate_scenarios(id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'calculated', 'archived')),
  composition_overrides jsonb not null default '{}'::jsonb,
  commercial_overrides jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (estimate_id, code),
  check (jsonb_typeof(composition_overrides) = 'object'),
  check (jsonb_typeof(commercial_overrides) = 'object')
);

create table if not exists public.steel_frame_catalog_snapshots (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  scenario_id uuid references public.steel_frame_estimate_scenarios(id) on delete set null,
  captured_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  snapshot_kind text not null check (snapshot_kind in ('calculation', 'technical_review', 'proposal')),
  content_sha256 text not null check (content_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  snapshot jsonb not null,
  created_at timestamp with time zone not null default now(),
  check (jsonb_typeof(snapshot) = 'object')
);

create table if not exists public.steel_frame_catalog_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamp with time zone not null default now()
);

alter table public.steel_frame_technical_rules drop constraint if exists steel_frame_technical_rules_status_check;
alter table public.steel_frame_technical_rules
  add constraint steel_frame_technical_rules_status_check
  check (status in ('draft', 'pending_validation', 'approved', 'deprecated', 'superseded', 'archived')) not valid;
alter table public.steel_frame_technical_rules
  add constraint steel_frame_technical_rules_strategy_type_check
  check (strategy_type is null or strategy_type in (
    'STUD_BY_SPACING', 'TRACK_BY_WALL_LENGTH', 'BLOCKING_BY_STUD_PATTERN',
    'BOARD_BY_AREA_COEFFICIENT', 'MEMBRANE_BY_AREA', 'INSULATION_BY_AREA',
    'FASTENER_BY_AREA', 'FASTENER_BY_BOARD', 'FIXED_PER_OPENING',
    'FIXED_PER_PROJECT', 'MANUAL', 'CUTTING_STOCK_OPTIMIZATION',
    'PACKAGING_ROUNDING'
  )) not valid;
alter table public.steel_frame_technical_rules
  add constraint steel_frame_technical_rules_published_contract_check
  check (
    status <> 'approved'
    or (
      strategy_type is not null
      and parameter_schema_version is not null and parameter_schema_version > 0
      and technical_input_unit is not null
      and purchase_unit is not null
      and source_id is not null
      and source_document_id is not null
      and jsonb_typeof(parameters) = 'object'
    )
  ) not valid;

alter table public.steel_frame_technical_compositions drop constraint if exists steel_frame_technical_compositions_status_check;
alter table public.steel_frame_technical_compositions
  add constraint steel_frame_technical_compositions_status_check
  check (status in ('draft', 'pending_validation', 'approved', 'deprecated', 'superseded', 'archived')) not valid;
alter table public.steel_frame_technical_compositions
  add constraint steel_frame_technical_compositions_height_range_check
  check (max_wall_height_meters is null or min_wall_height_meters is null or max_wall_height_meters >= min_wall_height_meters) not valid;
alter table public.steel_frame_technical_compositions
  add constraint steel_frame_technical_compositions_published_contract_check
  check (status <> 'approved' or (source_id is not null and source_document_id is not null)) not valid;

create index if not exists steel_frame_technical_sources_status_idx
  on public.steel_frame_technical_sources(status, updated_at desc);
create index if not exists steel_frame_technical_source_documents_source_idx
  on public.steel_frame_technical_source_documents(source_id, status, created_at desc);
create index if not exists steel_frame_material_variants_material_idx
  on public.steel_frame_material_variants(material_id, status, active);
create index if not exists steel_frame_material_coefficients_material_idx
  on public.steel_frame_material_coefficients(material_id, status, effective_from desc);
create index if not exists steel_frame_material_compatibilities_material_idx
  on public.steel_frame_material_compatibilities(material_id, material_variant_id, status);
create index if not exists steel_frame_technical_composition_layers_composition_idx
  on public.steel_frame_technical_composition_layers(composition_id, sort_order);
create index if not exists steel_frame_estimate_scenarios_estimate_idx
  on public.steel_frame_estimate_scenarios(estimate_id, updated_at desc);
create index if not exists steel_frame_catalog_snapshots_estimate_idx
  on public.steel_frame_catalog_snapshots(estimate_id, created_at desc);
create index if not exists steel_frame_catalog_audit_logs_entity_idx
  on public.steel_frame_catalog_audit_logs(entity_type, entity_id, created_at desc);
create unique index if not exists steel_frame_material_prices_preferred_variant_idx
  on public.steel_frame_material_prices(material_variant_id)
  where preferred and material_variant_id is not null and effective_to is null;

create or replace function public.validate_steel_frame_catalog_source_reference()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  document_source_id uuid;
begin
  if new.source_document_id is not null then
    select source_id into document_source_id
    from public.steel_frame_technical_source_documents
    where id = new.source_document_id;

    if document_source_id is null then
      raise exception 'Documento tecnico de origem nao encontrado.';
    end if;
    if new.source_id is not null and document_source_id <> new.source_id then
      raise exception 'A fonte e o documento tecnico informado nao correspondem.';
    end if;
  end if;
  return new;
end;
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
      raise exception 'Artefatos tecnicos publicados, descontinuados ou arquivados nao podem ser excluidos.';
    end if;
    return old;
  end if;

  if old.status = 'approved' then
    if new.status not in ('deprecated', 'superseded', 'archived')
      or (to_jsonb(new) - 'updated_at' - 'status' - 'deprecated_at')
        is distinct from (to_jsonb(old) - 'updated_at' - 'status' - 'deprecated_at') then
      raise exception 'Um artefato tecnico aprovado nao pode ser alterado. Crie uma nova versao.';
    end if;
    if not public.can_approve_steel_frame_technical_catalog() then
      raise exception 'Permissao insuficiente para encerrar uma versao tecnica aprovada.';
    end if;
    if new.status in ('deprecated', 'superseded') then
      new.deprecated_at := coalesce(new.deprecated_at, now());
    end if;
    return new;
  end if;

  if new.status = 'approved' and old.status <> 'approved' then
    if not public.can_approve_steel_frame_technical_catalog() then
      raise exception 'Permissao insuficiente para aprovar o catalogo tecnico.';
    end if;
    if nullif(trim(coalesce(new.technical_responsible_name, '')), '') is null
      or nullif(trim(coalesce(new.technical_responsible_registration, '')), '') is null
      or new.effective_from is null
      or new.source_id is null
      or new.source_document_id is null then
      raise exception 'Informe fonte, documento, responsavel tecnico, registro e vigencia antes de aprovar.';
    end if;
    if tg_table_name = 'steel_frame_technical_rules' then
      if nullif(trim(coalesce(new.reference_name, '')), '') is null
        or nullif(trim(coalesce(new.reference_version, '')), '') is null
        or new.strategy_type is null
        or new.parameter_schema_version is null
        or new.parameter_schema_version <= 0
        or nullif(trim(coalesce(new.technical_input_unit, '')), '') is null
        or nullif(trim(coalesce(new.purchase_unit, '')), '') is null
        or jsonb_typeof(new.parameters) <> 'object' then
        raise exception 'Uma regra aprovada precisa de estrategia tipada, schema de parametros, unidades e referencia tecnica completa.';
      end if;
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;

  if new.status in ('deprecated', 'superseded') and old.status not in ('deprecated', 'superseded') then
    new.deprecated_at := coalesce(new.deprecated_at, now());
  end if;

  return new;
end;
$$;

create or replace function public.guard_steel_frame_catalog_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Itens do catalogo tecnico devem ser criados como rascunho.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Itens tecnicos publicados, descontinuados ou arquivados nao podem ser excluidos.';
    end if;
    return old;
  end if;

  if old.status = 'approved' then
    if new.status not in ('deprecated', 'archived')
      or (to_jsonb(new) - 'updated_at' - 'status' - 'deprecated_at')
        is distinct from (to_jsonb(old) - 'updated_at' - 'status' - 'deprecated_at') then
      raise exception 'Um item tecnico aprovado nao pode ser alterado. Crie uma nova versao.';
    end if;
    if not public.can_approve_steel_frame_technical_catalog() then
      raise exception 'Permissao insuficiente para encerrar uma versao tecnica aprovada.';
    end if;
    if new.status = 'deprecated' then
      new.deprecated_at := coalesce(new.deprecated_at, now());
    end if;
    return new;
  end if;

  if new.status = 'approved' and old.status <> 'approved' then
    if not public.can_approve_steel_frame_technical_catalog() then
      raise exception 'Permissao insuficiente para aprovar o catalogo tecnico.';
    end if;
    if tg_table_name <> 'steel_frame_technical_sources'
      and nullif(coalesce(to_jsonb(new)->>'source_id', ''), '') is null then
      raise exception 'Informe a fonte tecnica antes de aprovar este item.';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;

  if new.status = 'deprecated' and old.status <> 'deprecated' then
    new.deprecated_at := coalesce(new.deprecated_at, now());
  end if;
  return new;
end;
$$;

create or replace function public.guard_steel_frame_technical_composition_layer_mutation()
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
    raise exception 'As camadas de uma composicao publicada nao podem ser alteradas. Crie uma nova versao.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.write_steel_frame_catalog_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_id uuid;
begin
  current_id := case when tg_op = 'DELETE' then old.id else new.id end;
  insert into public.steel_frame_catalog_audit_logs (
    actor_id,
    entity_type,
    entity_id,
    action,
    previous_value,
    new_value
  ) values (
    auth.uid(),
    tg_table_name,
    current_id,
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists steel_frame_technical_rules_source_reference on public.steel_frame_technical_rules;
create trigger steel_frame_technical_rules_source_reference
before insert or update on public.steel_frame_technical_rules
for each row execute function public.validate_steel_frame_catalog_source_reference();
drop trigger if exists steel_frame_technical_compositions_source_reference on public.steel_frame_technical_compositions;
create trigger steel_frame_technical_compositions_source_reference
before insert or update on public.steel_frame_technical_compositions
for each row execute function public.validate_steel_frame_catalog_source_reference();
drop trigger if exists steel_frame_material_variants_source_reference on public.steel_frame_material_variants;
create trigger steel_frame_material_variants_source_reference
before insert or update on public.steel_frame_material_variants
for each row execute function public.validate_steel_frame_catalog_source_reference();
drop trigger if exists steel_frame_material_coefficients_source_reference on public.steel_frame_material_coefficients;
create trigger steel_frame_material_coefficients_source_reference
before insert or update on public.steel_frame_material_coefficients
for each row execute function public.validate_steel_frame_catalog_source_reference();
drop trigger if exists steel_frame_material_compatibilities_source_reference on public.steel_frame_material_compatibilities;
create trigger steel_frame_material_compatibilities_source_reference
before insert or update on public.steel_frame_material_compatibilities
for each row execute function public.validate_steel_frame_catalog_source_reference();
drop trigger if exists steel_frame_technical_composition_layers_source_reference on public.steel_frame_technical_composition_layers;
create trigger steel_frame_technical_composition_layers_source_reference
before insert or update on public.steel_frame_technical_composition_layers
for each row execute function public.validate_steel_frame_catalog_source_reference();
drop trigger if exists steel_frame_reinforcement_templates_source_reference on public.steel_frame_reinforcement_templates;
create trigger steel_frame_reinforcement_templates_source_reference
before insert or update on public.steel_frame_reinforcement_templates
for each row execute function public.validate_steel_frame_catalog_source_reference();

drop trigger if exists steel_frame_technical_sources_guard on public.steel_frame_technical_sources;
create trigger steel_frame_technical_sources_guard
before insert or update or delete on public.steel_frame_technical_sources
for each row execute function public.guard_steel_frame_catalog_lifecycle();
drop trigger if exists steel_frame_technical_source_documents_guard on public.steel_frame_technical_source_documents;
create trigger steel_frame_technical_source_documents_guard
before insert or update or delete on public.steel_frame_technical_source_documents
for each row execute function public.guard_steel_frame_catalog_lifecycle();
drop trigger if exists steel_frame_material_variants_guard on public.steel_frame_material_variants;
create trigger steel_frame_material_variants_guard
before insert or update or delete on public.steel_frame_material_variants
for each row execute function public.guard_steel_frame_catalog_lifecycle();
drop trigger if exists steel_frame_material_coefficients_guard on public.steel_frame_material_coefficients;
create trigger steel_frame_material_coefficients_guard
before insert or update or delete on public.steel_frame_material_coefficients
for each row execute function public.guard_steel_frame_catalog_lifecycle();
drop trigger if exists steel_frame_material_compatibilities_guard on public.steel_frame_material_compatibilities;
create trigger steel_frame_material_compatibilities_guard
before insert or update or delete on public.steel_frame_material_compatibilities
for each row execute function public.guard_steel_frame_catalog_lifecycle();
drop trigger if exists steel_frame_reinforcement_templates_guard on public.steel_frame_reinforcement_templates;
create trigger steel_frame_reinforcement_templates_guard
before insert or update or delete on public.steel_frame_reinforcement_templates
for each row execute function public.guard_steel_frame_catalog_lifecycle();
drop trigger if exists steel_frame_technical_composition_layers_guard on public.steel_frame_technical_composition_layers;
create trigger steel_frame_technical_composition_layers_guard
before insert or update or delete on public.steel_frame_technical_composition_layers
for each row execute function public.guard_steel_frame_technical_composition_layer_mutation();

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'steel_frame_technical_sources',
    'steel_frame_technical_source_documents',
    'steel_frame_material_variants',
    'steel_frame_material_coefficients',
    'steel_frame_material_compatibilities',
    'steel_frame_technical_composition_layers',
    'steel_frame_estimate_scenarios'
  ] loop
    execute format('drop trigger if exists %I on public.%I', target_table || '_updated_at', target_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_steel_frame_updated_at()',
      target_table || '_updated_at',
      target_table
    );
  end loop;
end;
$$;

drop trigger if exists steel_frame_technical_sources_audit on public.steel_frame_technical_sources;
create trigger steel_frame_technical_sources_audit
after insert or update or delete on public.steel_frame_technical_sources
for each row execute function public.write_steel_frame_catalog_audit();
drop trigger if exists steel_frame_technical_source_documents_audit on public.steel_frame_technical_source_documents;
create trigger steel_frame_technical_source_documents_audit
after insert or update or delete on public.steel_frame_technical_source_documents
for each row execute function public.write_steel_frame_catalog_audit();
drop trigger if exists steel_frame_material_variants_audit on public.steel_frame_material_variants;
create trigger steel_frame_material_variants_audit
after insert or update or delete on public.steel_frame_material_variants
for each row execute function public.write_steel_frame_catalog_audit();
drop trigger if exists steel_frame_material_coefficients_audit on public.steel_frame_material_coefficients;
create trigger steel_frame_material_coefficients_audit
after insert or update or delete on public.steel_frame_material_coefficients
for each row execute function public.write_steel_frame_catalog_audit();
drop trigger if exists steel_frame_material_compatibilities_audit on public.steel_frame_material_compatibilities;
create trigger steel_frame_material_compatibilities_audit
after insert or update or delete on public.steel_frame_material_compatibilities
for each row execute function public.write_steel_frame_catalog_audit();
drop trigger if exists steel_frame_technical_composition_layers_audit on public.steel_frame_technical_composition_layers;
create trigger steel_frame_technical_composition_layers_audit
after insert or update or delete on public.steel_frame_technical_composition_layers
for each row execute function public.write_steel_frame_catalog_audit();
drop trigger if exists steel_frame_reinforcement_templates_audit on public.steel_frame_reinforcement_templates;
create trigger steel_frame_reinforcement_templates_audit
after insert or update or delete on public.steel_frame_reinforcement_templates
for each row execute function public.write_steel_frame_catalog_audit();

create or replace function public.guard_steel_frame_catalog_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Snapshots de catalogo sao imutaveis e nao podem ser alterados ou excluidos.';
  end if;
  return new;
end;
$$;

drop trigger if exists steel_frame_catalog_snapshots_immutable on public.steel_frame_catalog_snapshots;
create trigger steel_frame_catalog_snapshots_immutable
before insert or update or delete on public.steel_frame_catalog_snapshots
for each row execute function public.guard_steel_frame_catalog_snapshot_mutation();

alter table public.steel_frame_technical_sources enable row level security;
alter table public.steel_frame_technical_source_documents enable row level security;
alter table public.steel_frame_material_variants enable row level security;
alter table public.steel_frame_material_coefficients enable row level security;
alter table public.steel_frame_material_compatibilities enable row level security;
alter table public.steel_frame_technical_composition_layers enable row level security;
alter table public.steel_frame_estimate_scenarios enable row level security;
alter table public.steel_frame_catalog_snapshots enable row level security;
alter table public.steel_frame_catalog_audit_logs enable row level security;

drop policy if exists "steel_frame_technical_sources_manage" on public.steel_frame_technical_sources;
create policy "steel_frame_technical_sources_manage" on public.steel_frame_technical_sources
for all using (public.can_manage_steel_frame_catalog()) with check (public.can_manage_steel_frame_catalog());
drop policy if exists "steel_frame_technical_source_documents_manage" on public.steel_frame_technical_source_documents;
create policy "steel_frame_technical_source_documents_manage" on public.steel_frame_technical_source_documents
for all using (public.can_manage_steel_frame_catalog()) with check (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_material_variants_select_authorized" on public.steel_frame_material_variants;
create policy "steel_frame_material_variants_select_authorized" on public.steel_frame_material_variants
for select using (public.can_manage_steel_frame_catalog() or (status = 'approved' and public.can_view_steel_frame_catalog()));
drop policy if exists "steel_frame_material_variants_manage" on public.steel_frame_material_variants;
create policy "steel_frame_material_variants_manage" on public.steel_frame_material_variants
for all using (public.can_manage_steel_frame_catalog()) with check (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_material_coefficients_select_authorized" on public.steel_frame_material_coefficients;
create policy "steel_frame_material_coefficients_select_authorized" on public.steel_frame_material_coefficients
for select using (public.can_manage_steel_frame_catalog() or (status = 'approved' and public.can_view_steel_frame_catalog()));
drop policy if exists "steel_frame_material_coefficients_manage" on public.steel_frame_material_coefficients;
create policy "steel_frame_material_coefficients_manage" on public.steel_frame_material_coefficients
for all using (public.can_manage_steel_frame_catalog()) with check (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_material_compatibilities_select_authorized" on public.steel_frame_material_compatibilities;
create policy "steel_frame_material_compatibilities_select_authorized" on public.steel_frame_material_compatibilities
for select using (public.can_manage_steel_frame_catalog() or (status = 'approved' and public.can_view_steel_frame_catalog()));
drop policy if exists "steel_frame_material_compatibilities_manage" on public.steel_frame_material_compatibilities;
create policy "steel_frame_material_compatibilities_manage" on public.steel_frame_material_compatibilities
for all using (public.can_manage_steel_frame_catalog()) with check (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_technical_composition_layers_select_authorized" on public.steel_frame_technical_composition_layers;
create policy "steel_frame_technical_composition_layers_select_authorized" on public.steel_frame_technical_composition_layers
for select using (
  exists (
    select 1
    from public.steel_frame_technical_compositions composition_row
    where composition_row.id = composition_id
      and (public.can_manage_steel_frame_catalog() or (composition_row.status = 'approved' and public.can_view_steel_frame_catalog()))
  )
);
drop policy if exists "steel_frame_technical_composition_layers_manage" on public.steel_frame_technical_composition_layers;
create policy "steel_frame_technical_composition_layers_manage" on public.steel_frame_technical_composition_layers
for all using (public.can_manage_steel_frame_catalog()) with check (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_estimate_scenarios_select_authorized" on public.steel_frame_estimate_scenarios;
create policy "steel_frame_estimate_scenarios_select_authorized" on public.steel_frame_estimate_scenarios
for select using (public.can_access_steel_frame_estimate(estimate_id));
drop policy if exists "steel_frame_estimate_scenarios_insert_authorized" on public.steel_frame_estimate_scenarios;
create policy "steel_frame_estimate_scenarios_insert_authorized" on public.steel_frame_estimate_scenarios
for insert with check (created_by = auth.uid() and public.can_edit_steel_frame_estimate(estimate_id));
drop policy if exists "steel_frame_estimate_scenarios_update_authorized" on public.steel_frame_estimate_scenarios;
create policy "steel_frame_estimate_scenarios_update_authorized" on public.steel_frame_estimate_scenarios
for update using (public.can_edit_steel_frame_estimate(estimate_id)) with check (public.can_edit_steel_frame_estimate(estimate_id));

drop policy if exists "steel_frame_catalog_snapshots_select_authorized" on public.steel_frame_catalog_snapshots;
create policy "steel_frame_catalog_snapshots_select_authorized" on public.steel_frame_catalog_snapshots
for select using (public.can_read_steel_frame_financials(estimate_id));
drop policy if exists "steel_frame_catalog_snapshots_insert_authorized" on public.steel_frame_catalog_snapshots;
create policy "steel_frame_catalog_snapshots_insert_authorized" on public.steel_frame_catalog_snapshots
for insert with check (captured_by = auth.uid() and public.can_edit_steel_frame_estimate(estimate_id));
drop policy if exists "steel_frame_catalog_audit_logs_select_manage" on public.steel_frame_catalog_audit_logs;
create policy "steel_frame_catalog_audit_logs_select_manage" on public.steel_frame_catalog_audit_logs
for select using (public.can_manage_steel_frame_catalog());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'steel-frame-catalog',
  'steel-frame-catalog',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "steel_frame_catalog_storage_select_manage" on storage.objects;
create policy "steel_frame_catalog_storage_select_manage" on storage.objects
for select using (bucket_id = 'steel-frame-catalog' and public.can_manage_steel_frame_catalog());
drop policy if exists "steel_frame_catalog_storage_insert_manage" on storage.objects;
create policy "steel_frame_catalog_storage_insert_manage" on storage.objects
for insert with check (
  bucket_id = 'steel-frame-catalog'
  and public.can_manage_steel_frame_catalog()
  and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "steel_frame_catalog_storage_delete_manage" on storage.objects;
create policy "steel_frame_catalog_storage_delete_manage" on storage.objects
for delete using (bucket_id = 'steel-frame-catalog' and public.can_manage_steel_frame_catalog());

grant select, insert, update, delete on table
  public.steel_frame_technical_sources,
  public.steel_frame_technical_source_documents,
  public.steel_frame_material_variants,
  public.steel_frame_material_coefficients,
  public.steel_frame_material_compatibilities,
  public.steel_frame_technical_composition_layers,
  public.steel_frame_estimate_scenarios,
  public.steel_frame_catalog_snapshots,
  public.steel_frame_catalog_audit_logs
to authenticated;

grant execute on function public.validate_steel_frame_catalog_source_reference() to authenticated;
grant execute on function public.guard_steel_frame_catalog_lifecycle() to authenticated;
grant execute on function public.guard_steel_frame_technical_composition_layer_mutation() to authenticated;
grant execute on function public.guard_steel_frame_catalog_snapshot_mutation() to authenticated;

revoke all on function public.validate_steel_frame_catalog_source_reference() from public;
revoke all on function public.guard_steel_frame_catalog_lifecycle() from public;
revoke all on function public.guard_steel_frame_technical_composition_layer_mutation() from public;
revoke all on function public.write_steel_frame_catalog_audit() from public;
revoke all on function public.guard_steel_frame_catalog_snapshot_mutation() from public;

comment on table public.steel_frame_technical_sources is 'Phase 2 metadata-only technical source register. No protected source content is stored here.';
comment on table public.steel_frame_technical_source_documents is 'Private file metadata for licensed technical references. Files remain in the private steel-frame-catalog bucket.';
comment on table public.steel_frame_material_variants is 'Versioned commercial variants of existing generic Steel Frame materials.';
comment on table public.steel_frame_material_coefficients is 'Versioned technical consumption coefficients. Only approved records may feed final calculations.';
comment on table public.steel_frame_material_compatibilities is 'Versioned compatibility graph for material substitutions and related components.';
comment on table public.steel_frame_technical_composition_layers is 'Ordered layers of a versioned technical composition.';
comment on table public.steel_frame_estimate_scenarios is 'Estimate scenarios sharing the same confirmed geometry source version.';
comment on table public.steel_frame_catalog_snapshots is 'Immutable catalog and calculation inputs captured for estimate traceability.';
