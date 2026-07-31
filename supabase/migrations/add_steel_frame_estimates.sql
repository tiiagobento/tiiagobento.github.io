-- Nova Forma CRM: Steel Frame estimates.
-- Non-destructive and idempotent. Apply after add_access_control.sql,
-- add_partner_briefing.sql and add_partner_commissions_and_lead_files.sql.
-- This migration never deletes CRM data and keeps all estimate documents private.

create extension if not exists pgcrypto;

create table if not exists public.steel_frame_estimates (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  commercial_responsible_id uuid references public.profiles(id) on delete set null,
  technical_responsible_id uuid references public.profiles(id) on delete set null,
  title text not null,
  mode text not null default 'commercial' check (mode in ('commercial', 'technical')),
  status text not null default 'draft' check (status in (
    'draft', 'needs_information', 'in_review', 'approved', 'proposal_generated',
    'sent', 'accepted', 'expired', 'cancelled'
  )),
  city text,
  neighborhood text,
  approximate_address text,
  project_type text,
  standard_wall_height_meters numeric(8,3) check (standard_wall_height_meters > 0),
  expected_floors integer check (expected_floors > 0),
  access_difficulty text check (access_difficulty in ('low', 'medium', 'high')),
  requires_material_lift boolean,
  notes text,
  current_version_number integer not null default 0 check (current_version_number >= 0),
  archived_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_estimate_versions (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in (
    'draft', 'needs_information', 'in_review', 'approved', 'proposal_generated',
    'sent', 'accepted', 'expired', 'cancelled'
  )),
  snapshot jsonb not null default '{}'::jsonb,
  technical_review_notes text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamp with time zone,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamp with time zone,
  frozen_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (estimate_id, version_number)
);

create table if not exists public.steel_frame_documents (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  uploaded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  original_file_name text not null,
  storage_path text not null unique,
  processed_storage_path text,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 20971520),
  page_count integer check (page_count > 0),
  document_type text not null default 'reference' check (document_type in (
    'plant', 'sketch', 'facade', 'photo', 'quote', 'technical_document', 'reference', 'proposal'
  )),
  visibility text not null default 'technical' check (visibility in ('commercial', 'technical', 'internal')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_ai_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  document_id uuid references public.steel_frame_documents(id) on delete set null,
  requested_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  provider text,
  model text,
  status text not null default 'queued' check (status in (
    'queued', 'processing', 'needs_review', 'completed', 'failed', 'cancelled'
  )),
  prompt_version text,
  request_metadata jsonb not null default '{}'::jsonb,
  response_metadata jsonb,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_ai_extractions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.steel_frame_ai_analysis_jobs(id) on delete cascade,
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  field_name text not null,
  entity_type text not null default 'estimate',
  value jsonb,
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  confirmation_status text not null default 'needs_confirmation' check (
    confirmation_status in ('confirmed', 'needs_confirmation', 'not_applicable')
  ),
  source_document_id uuid references public.steel_frame_documents(id) on delete set null,
  page_number integer check (page_number > 0),
  source_text text,
  bounding_box jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_ai_questions (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  job_id uuid references public.steel_frame_ai_analysis_jobs(id) on delete set null,
  field_name text,
  question text not null,
  answer jsonb,
  status text not null default 'open' check (status in ('open', 'answered', 'dismissed')),
  created_by uuid references public.profiles(id) on delete set null,
  answered_by uuid references public.profiles(id) on delete set null,
  answered_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_ai_corrections (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  extraction_id uuid references public.steel_frame_ai_extractions(id) on delete set null,
  field_name text not null,
  previous_value jsonb,
  corrected_value jsonb,
  corrected_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_wall_segments (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  label text not null,
  section_name text,
  length_meters numeric(10,3) not null check (length_meters > 0),
  height_meters numeric(10,3) not null check (height_meters > 0),
  quantity integer not null default 1 check (quantity > 0),
  gross_area_square_meters numeric(14,4) generated always as (length_meters * height_meters * quantity) stored,
  confirmation_status text not null default 'needs_confirmation' check (
    confirmation_status in ('confirmed', 'needs_confirmation', 'not_applicable')
  ),
  source_data jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_openings (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  wall_segment_id uuid references public.steel_frame_wall_segments(id) on delete set null,
  label text not null,
  opening_type text not null default 'other' check (opening_type in ('door', 'window', 'garage', 'opening', 'other')),
  width_meters numeric(10,3) not null check (width_meters > 0),
  height_meters numeric(10,3) not null check (height_meters > 0),
  quantity integer not null default 1 check (quantity > 0),
  opening_area_square_meters numeric(14,4) generated always as (width_meters * height_meters * quantity) stored,
  subtract_from_wall_area boolean not null default true,
  confirmation_status text not null default 'needs_confirmation' check (
    confirmation_status in ('confirmed', 'needs_confirmation', 'not_applicable')
  ),
  source_data jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_suppliers (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  name text not null,
  tax_id text,
  contact_name text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_materials (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  supplier_id uuid references public.steel_frame_suppliers(id) on delete set null,
  sku text,
  name text not null,
  category text not null,
  unit text not null,
  technical_specification jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique nulls not distinct (supplier_id, sku)
);

create table if not exists public.steel_frame_material_prices (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.steel_frame_materials(id) on delete cascade,
  supplier_id uuid references public.steel_frame_suppliers(id) on delete set null,
  currency text not null default 'BRL' check (currency = 'BRL'),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  effective_from date not null default current_date,
  effective_to date,
  source_reference text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.steel_frame_assemblies (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  name text not null,
  category text not null,
  description text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (name, category)
);

create table if not exists public.steel_frame_assembly_items (
  id uuid primary key default gen_random_uuid(),
  assembly_id uuid not null references public.steel_frame_assemblies(id) on delete cascade,
  material_id uuid references public.steel_frame_materials(id) on delete set null,
  label text not null,
  unit text not null,
  calculation_rule text not null check (calculation_rule in (
    'STUD_BY_SPACING', 'TRACK_BY_LINEAR_LENGTH', 'BOARD_BY_AREA', 'ROLL_BY_COVERAGE',
    'PACKAGE_BY_COVERAGE', 'FASTENER_BY_AREA', 'FASTENER_BY_BOARD', 'FASTENER_BY_STUD',
    'FIXED_PER_OPENING', 'FIXED_PER_PROJECT', 'LINEAR_BY_OPENING', 'MANUAL'
  )),
  rule_parameters jsonb not null default '{}'::jsonb,
  waste_percent numeric(6,3) not null default 0 check (waste_percent >= 0 and waste_percent <= 100),
  rounding_mode text not null default 'none' check (rounding_mode in ('none', 'ceil', 'nearest', 'floor')),
  rounding_multiple numeric(12,4) not null default 1 check (rounding_multiple > 0),
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_reinforcement_templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  name text not null,
  trigger_type text not null check (trigger_type in ('opening', 'span', 'height', 'manual')),
  trigger_parameters jsonb not null default '{}'::jsonb,
  assembly_id uuid references public.steel_frame_assemblies(id) on delete set null,
  instructions text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_calculated_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  assembly_id uuid references public.steel_frame_assemblies(id) on delete set null,
  assembly_item_id uuid references public.steel_frame_assembly_items(id) on delete set null,
  material_id uuid references public.steel_frame_materials(id) on delete set null,
  label text not null,
  category text not null,
  unit text not null,
  calculation_rule text not null check (calculation_rule in (
    'STUD_BY_SPACING', 'TRACK_BY_LINEAR_LENGTH', 'BOARD_BY_AREA', 'ROLL_BY_COVERAGE',
    'PACKAGE_BY_COVERAGE', 'FASTENER_BY_AREA', 'FASTENER_BY_BOARD', 'FASTENER_BY_STUD',
    'FIXED_PER_OPENING', 'FIXED_PER_PROJECT', 'LINEAR_BY_OPENING', 'MANUAL'
  )),
  rule_parameters jsonb not null default '{}'::jsonb,
  source_values jsonb not null default '{}'::jsonb,
  raw_quantity numeric(14,4) not null default 0 check (raw_quantity >= 0),
  waste_percent numeric(6,3) not null default 0 check (waste_percent >= 0 and waste_percent <= 100),
  calculated_quantity numeric(14,4) not null default 0 check (calculated_quantity >= 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  total_cost numeric(14,2) generated always as (calculated_quantity * unit_cost) stored,
  requires_technical_review boolean not null default false,
  confirmation_status text not null default 'needs_confirmation' check (
    confirmation_status in ('confirmed', 'needs_confirmation', 'not_applicable')
  ),
  source_data jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_labor_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  label text not null,
  quantity numeric(14,4) not null default 0 check (quantity >= 0),
  unit text not null,
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  total_cost numeric(14,2) generated always as (quantity * unit_cost) stored,
  notes text,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_operational_costs (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  category text not null,
  label text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  notes text,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_commercial_components (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  component_key text not null,
  calculation_basis text not null check (calculation_basis in ('fixed', 'percent_of_cost', 'percent_of_sale')),
  percentage numeric(7,4) check (percentage >= 0 and percentage <= 100),
  amount numeric(14,2) check (amount >= 0),
  notes text,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  check (
    (calculation_basis = 'fixed' and amount is not null)
    or (calculation_basis in ('percent_of_cost', 'percent_of_sale') and percentage is not null)
  ),
  unique nulls not distinct (estimate_id, estimate_version_id, component_key)
);

create table if not exists public.steel_frame_approvals (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid not null references public.steel_frame_estimate_versions(id) on delete cascade,
  approval_type text not null check (approval_type in ('technical_review', 'commercial_review', 'proposal_release')),
  decision text not null check (decision in ('approved', 'rejected', 'changes_requested')),
  notes text,
  approved_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.steel_frame_audit_logs (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.steel_frame_estimates(id) on delete cascade,
  estimate_version_id uuid references public.steel_frame_estimate_versions(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists steel_frame_estimates_lead_idx on public.steel_frame_estimates(lead_id);
create index if not exists steel_frame_estimates_created_by_idx on public.steel_frame_estimates(created_by);
create index if not exists steel_frame_estimates_technical_responsible_idx on public.steel_frame_estimates(technical_responsible_id);
create index if not exists steel_frame_estimates_status_idx on public.steel_frame_estimates(status, updated_at desc);
create index if not exists steel_frame_estimate_versions_estimate_idx on public.steel_frame_estimate_versions(estimate_id, version_number desc);
create index if not exists steel_frame_documents_estimate_idx on public.steel_frame_documents(estimate_id, created_at desc);
create index if not exists steel_frame_ai_jobs_estimate_idx on public.steel_frame_ai_analysis_jobs(estimate_id, created_at desc);
create index if not exists steel_frame_ai_extractions_job_idx on public.steel_frame_ai_extractions(job_id);
create index if not exists steel_frame_ai_questions_estimate_idx on public.steel_frame_ai_questions(estimate_id, status);
create index if not exists steel_frame_wall_segments_estimate_idx on public.steel_frame_wall_segments(estimate_id, sort_order);
create index if not exists steel_frame_openings_estimate_idx on public.steel_frame_openings(estimate_id, sort_order);
create index if not exists steel_frame_calculated_items_estimate_idx on public.steel_frame_calculated_items(estimate_id, sort_order);
create index if not exists steel_frame_audit_logs_estimate_idx on public.steel_frame_audit_logs(estimate_id, created_at desc);

create or replace function public.set_steel_frame_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_current_steel_frame_estimate_version(
  target_estimate_id uuid,
  target_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.steel_frame_estimates estimate_row
    join public.steel_frame_estimate_versions version_row
      on version_row.estimate_id = estimate_row.id
      and version_row.version_number = estimate_row.current_version_number
    where estimate_row.id = target_estimate_id
      and version_row.id = target_version_id
  );
$$;

create or replace function public.guard_steel_frame_version_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.frozen_at is not null
    or old.approved_at is not null
    or old.status in ('approved', 'proposal_generated', 'sent', 'accepted', 'expired', 'cancelled') then
    raise exception 'A versao % esta congelada e nao pode ser alterada.', old.version_number;
  end if;

  return new;
end;
$$;

create or replace function public.audit_steel_frame_estimate_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_estimate_id uuid;
  target_version_id uuid;
  target_entity_id uuid;
  before_payload jsonb;
  after_payload jsonb;
begin
  if tg_op = 'INSERT' then
    target_entity_id := new.id;
    after_payload := to_jsonb(new);
    if tg_table_name = 'steel_frame_estimates' then
      target_estimate_id := new.id;
    else
      target_estimate_id := new.estimate_id;
      target_version_id := new.id;
    end if;
  elsif tg_op = 'UPDATE' then
    target_entity_id := new.id;
    before_payload := to_jsonb(old);
    after_payload := to_jsonb(new);
    if tg_table_name = 'steel_frame_estimates' then
      target_estimate_id := new.id;
    else
      target_estimate_id := new.estimate_id;
      target_version_id := new.id;
    end if;
  else
    target_entity_id := old.id;
    before_payload := to_jsonb(old);
    if tg_table_name = 'steel_frame_estimates' then
      target_estimate_id := old.id;
    else
      target_estimate_id := old.estimate_id;
      target_version_id := old.id;
    end if;
  end if;

  insert into public.steel_frame_audit_logs (
    estimate_id,
    estimate_version_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data
  ) values (
    target_estimate_id,
    target_version_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    target_entity_id,
    before_payload,
    after_payload
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists steel_frame_estimates_updated_at on public.steel_frame_estimates;
create trigger steel_frame_estimates_updated_at before update on public.steel_frame_estimates
for each row execute function public.set_steel_frame_updated_at();

drop trigger if exists steel_frame_estimate_versions_updated_at on public.steel_frame_estimate_versions;
create trigger steel_frame_estimate_versions_updated_at before update on public.steel_frame_estimate_versions
for each row execute function public.set_steel_frame_updated_at();

drop trigger if exists steel_frame_estimate_versions_guard on public.steel_frame_estimate_versions;
create trigger steel_frame_estimate_versions_guard before update on public.steel_frame_estimate_versions
for each row execute function public.guard_steel_frame_version_mutation();

drop trigger if exists steel_frame_estimates_audit on public.steel_frame_estimates;
create trigger steel_frame_estimates_audit after insert or update on public.steel_frame_estimates
for each row execute function public.audit_steel_frame_estimate_change();

drop trigger if exists steel_frame_estimate_versions_audit on public.steel_frame_estimate_versions;
create trigger steel_frame_estimate_versions_audit after insert or update on public.steel_frame_estimate_versions
for each row execute function public.audit_steel_frame_estimate_change();

create or replace function public.guard_steel_frame_version_content_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_version_id uuid;
begin
  -- A proposal PDF is an immutable deliverable bound to the approved version.
  -- It can be uploaded after approval only by a user explicitly allowed to see
  -- financials and generate proposals; it does not reopen technical content.
  if tg_table_name = 'steel_frame_documents' then
    if tg_op = 'DELETE'
      and old.document_type = 'proposal'
      and old.visibility = 'internal'
      and old.uploaded_by = auth.uid()
      and public.is_current_steel_frame_estimate_version(old.estimate_id, old.estimate_version_id)
      and public.current_profile_is_active()
      and public.has_permission('estimates.proposals.generate')
      and (public.has_permission('estimates.manage_all') or public.has_permission('estimates.financials.view')) then
      return old;
    end if;

    if tg_op <> 'DELETE'
      and new.document_type = 'proposal'
      and new.visibility = 'internal'
      and new.uploaded_by = auth.uid()
      and public.is_current_steel_frame_estimate_version(new.estimate_id, new.estimate_version_id)
      and public.current_profile_is_active()
      and public.has_permission('estimates.proposals.generate')
      and (public.has_permission('estimates.manage_all') or public.has_permission('estimates.financials.view')) then
      if tg_op = 'UPDATE'
        and (
          new.estimate_id is distinct from old.estimate_id
          or new.estimate_version_id is distinct from old.estimate_version_id
          or new.uploaded_by is distinct from old.uploaded_by
          or new.original_file_name is distinct from old.original_file_name
          or new.storage_path is distinct from old.storage_path
          or new.processed_storage_path is distinct from old.processed_storage_path
          or new.mime_type is distinct from old.mime_type
          or new.file_size_bytes is distinct from old.file_size_bytes
          or new.document_type is distinct from old.document_type
          or new.visibility is distinct from old.visibility
        ) then
        raise exception 'Uma proposta aprovada nao pode ser movida ou ter seu arquivo substituido.';
      end if;

      return new;
    end if;
  end if;

  if tg_op = 'DELETE' then
    target_version_id := old.estimate_version_id;
  else
    target_version_id := new.estimate_version_id;
  end if;

  if target_version_id is not null and exists (
    select 1
    from public.steel_frame_estimate_versions version_row
    where version_row.id = target_version_id
      and (
        version_row.frozen_at is not null
        or version_row.approved_at is not null
        or version_row.status in ('approved', 'proposal_generated', 'sent', 'accepted', 'expired', 'cancelled')
      )
  ) then
    raise exception 'Os dados vinculados a uma versao aprovada ou congelada nao podem ser alterados.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.assign_steel_frame_current_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estimate_version_id is null then
    select version_row.id
    into new.estimate_version_id
    from public.steel_frame_estimates estimate_row
    join public.steel_frame_estimate_versions version_row
      on version_row.estimate_id = estimate_row.id
      and version_row.version_number = estimate_row.current_version_number
    where estimate_row.id = new.estimate_id;

    if new.estimate_version_id is null then
      raise exception 'Nao foi encontrada uma versao corrente para este orcamento.';
    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'steel_frame_documents',
    'steel_frame_ai_analysis_jobs',
    'steel_frame_ai_questions',
    'steel_frame_wall_segments',
    'steel_frame_openings',
    'steel_frame_calculated_items',
    'steel_frame_labor_items',
    'steel_frame_operational_costs',
    'steel_frame_commercial_components'
  ] loop
    execute format('drop trigger if exists %I on public.%I', target_table || '_assign_current_version', target_table);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.assign_steel_frame_current_version()',
      target_table || '_assign_current_version',
      target_table
    );
  end loop;

  foreach target_table in array array[
    'steel_frame_documents',
    'steel_frame_ai_analysis_jobs',
    'steel_frame_ai_extractions',
    'steel_frame_ai_questions',
    'steel_frame_wall_segments',
    'steel_frame_openings',
    'steel_frame_suppliers',
    'steel_frame_materials',
    'steel_frame_material_prices',
    'steel_frame_assemblies',
    'steel_frame_assembly_items',
    'steel_frame_reinforcement_templates',
    'steel_frame_calculated_items',
    'steel_frame_labor_items',
    'steel_frame_operational_costs',
    'steel_frame_commercial_components'
  ] loop
    execute format('drop trigger if exists %I on public.%I', target_table || '_updated_at', target_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_steel_frame_updated_at()',
      target_table || '_updated_at',
      target_table
    );
  end loop;

  foreach target_table in array array[
    'steel_frame_documents',
    'steel_frame_ai_analysis_jobs',
    'steel_frame_ai_questions',
    'steel_frame_wall_segments',
    'steel_frame_openings',
    'steel_frame_calculated_items',
    'steel_frame_labor_items',
    'steel_frame_operational_costs',
    'steel_frame_commercial_components'
  ] loop
    execute format('drop trigger if exists %I on public.%I', target_table || '_version_guard', target_table);
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function public.guard_steel_frame_version_content_mutation()',
      target_table || '_version_guard',
      target_table
    );
  end loop;
end;
$$;

insert into public.permissions (key, label, category, description) values
  ('estimates.view_own', 'Ver proprios orcamentos', 'Orcamentos', 'Acessa orcamentos criados por si ou vinculados a seus leads.'),
  ('estimates.view_assigned', 'Ver orcamentos atribuidos', 'Orcamentos', 'Acessa somente orcamentos explicitamente atribuidos para revisao ou parceria.'),
  ('estimates.create', 'Criar orcamentos', 'Orcamentos', 'Permite criar rascunhos de orcamentos Steel Frame.'),
  ('estimates.update_own', 'Editar proprios orcamentos', 'Orcamentos', 'Permite editar rascunhos autorizados.'),
  ('estimates.review_assigned', 'Revisar orcamentos atribuidos', 'Orcamentos', 'Permite revisao tecnica de orcamentos atribuidos.'),
  ('estimates.manage_all', 'Gerenciar todos os orcamentos', 'Orcamentos', 'Permite administrar todos os orcamentos e configuracoes associadas.'),
  ('estimates.catalog.view', 'Consultar catalogo Steel Frame', 'Orcamentos', 'Permite consultar materiais, composicoes e reforcos.'),
  ('estimates.catalog.manage', 'Gerenciar catalogo Steel Frame', 'Orcamentos', 'Permite cadastrar e alterar catalogo tecnico.'),
  ('estimates.prices.view', 'Consultar precos Steel Frame', 'Orcamentos', 'Permite consultar custos de materiais.'),
  ('estimates.prices.manage', 'Gerenciar precos Steel Frame', 'Orcamentos', 'Permite cadastrar e atualizar precos.'),
  ('estimates.financials.view', 'Ver financeiros de orcamentos', 'Orcamentos', 'Permite ver custos, precificacao e margem.'),
  ('estimates.proposals.generate', 'Gerar propostas', 'Orcamentos', 'Permite gerar PDF comercial de um orcamento aprovado.'),
  ('estimates.approve', 'Aprovar orcamentos', 'Orcamentos', 'Permite aprovar revisoes tecnicas e liberacoes comerciais.'),
  ('estimates.audit.view', 'Ver auditoria de orcamentos', 'Orcamentos', 'Permite consultar historico e correcoes do orcamento.')
on conflict (key) do update set
  label = excluded.label,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (role, permission_key, allowed)
select 'user', permission_key, true
from (values
  ('estimates.view_own'),
  ('estimates.create'),
  ('estimates.update_own'),
  ('estimates.catalog.view'),
  ('estimates.prices.view'),
  ('estimates.financials.view'),
  ('estimates.proposals.generate')
) as defaults(permission_key)
on conflict (role, permission_key) do nothing;

create or replace function public.can_access_steel_frame_estimate(target_estimate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_is_active()
    and exists (
      select 1
      from public.steel_frame_estimates estimate_row
      left join public.leads lead_row on lead_row.id = estimate_row.lead_id
      where estimate_row.id = target_estimate_id
        and (
          public.has_permission('estimates.manage_all')
          or (
            public.has_permission('estimates.view_own')
            and (estimate_row.created_by = auth.uid() or lead_row.user_id = auth.uid())
          )
          or (
            public.has_permission('estimates.view_assigned')
            and (
              estimate_row.technical_responsible_id = auth.uid()
              or lead_row.partner_id = auth.uid()
            )
          )
        )
    );
$$;

create or replace function public.can_edit_steel_frame_estimate(target_estimate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_steel_frame_estimate(target_estimate_id)
    and exists (
      select 1
      from public.steel_frame_estimates estimate_row
      left join public.leads lead_row on lead_row.id = estimate_row.lead_id
      where estimate_row.id = target_estimate_id
        and estimate_row.status in ('draft', 'needs_information', 'in_review')
        and (
          public.has_permission('estimates.manage_all')
          or (
            public.has_permission('estimates.update_own')
            and (estimate_row.created_by = auth.uid() or lead_row.user_id = auth.uid())
          )
          or (
            public.has_permission('estimates.review_assigned')
            and estimate_row.technical_responsible_id = auth.uid()
          )
        )
    );
$$;

create or replace function public.can_read_steel_frame_financials(target_estimate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_steel_frame_estimate(target_estimate_id)
    and (
      public.has_permission('estimates.manage_all')
      or public.has_permission('estimates.financials.view')
    );
$$;

create or replace function public.can_view_steel_frame_catalog()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_is_active()
    and (
      public.has_permission('estimates.manage_all')
      or public.has_permission('estimates.catalog.view')
      or public.has_permission('estimates.catalog.manage')
    );
$$;

create or replace function public.can_manage_steel_frame_catalog()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_is_active()
    and (
      public.has_permission('estimates.manage_all')
      or public.has_permission('estimates.catalog.manage')
    );
$$;

create or replace function public.can_approve_steel_frame_estimate(target_estimate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_steel_frame_estimate(target_estimate_id)
    and exists (
      select 1
      from public.steel_frame_estimates estimate_row
      where estimate_row.id = target_estimate_id
        and (
          public.has_permission('estimates.manage_all')
          or (
            public.has_permission('estimates.approve')
            and estimate_row.technical_responsible_id = auth.uid()
          )
        )
    );
$$;

create or replace function public.can_generate_steel_frame_proposal(target_estimate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_read_steel_frame_financials(target_estimate_id)
    and public.current_profile_is_active()
    and (
      public.has_permission('estimates.manage_all')
      or public.has_permission('estimates.proposals.generate')
    )
    and exists (
      select 1
      from public.steel_frame_estimates estimate_row
      where estimate_row.id = target_estimate_id
        and estimate_row.status in ('approved', 'proposal_generated', 'sent')
    );
$$;

create or replace function public.create_steel_frame_estimate(
  estimate_title text,
  estimate_mode text default 'commercial',
  estimate_lead_id uuid default null,
  estimate_city text default null,
  estimate_neighborhood text default null,
  estimate_approximate_address text default null,
  estimate_project_type text default null,
  estimate_standard_wall_height_meters numeric default null,
  estimate_expected_floors integer default null,
  estimate_access_difficulty text default null,
  estimate_requires_material_lift boolean default null,
  estimate_notes text default null
)
returns public.steel_frame_estimates
language plpgsql
security definer
set search_path = public
as $$
declare
  estimate_row public.steel_frame_estimates%rowtype;
begin
  if not public.current_profile_is_active() or not public.has_permission('estimates.create') then
    raise exception 'Permissao insuficiente para criar orcamentos.';
  end if;

  if char_length(trim(coalesce(estimate_title, ''))) < 3 then
    raise exception 'Informe um titulo com pelo menos tres caracteres.';
  end if;

  if estimate_mode not in ('commercial', 'technical') then
    raise exception 'Modo de orcamento invalido.';
  end if;

  if estimate_access_difficulty is not null and estimate_access_difficulty not in ('low', 'medium', 'high') then
    raise exception 'Dificuldade de acesso invalida.';
  end if;

  if estimate_standard_wall_height_meters is not null and estimate_standard_wall_height_meters <= 0 then
    raise exception 'A altura de parede deve ser maior que zero.';
  end if;

  if estimate_expected_floors is not null and estimate_expected_floors <= 0 then
    raise exception 'A quantidade de pavimentos deve ser maior que zero.';
  end if;

  if estimate_lead_id is not null and not exists (
    select 1
    from public.leads lead_row
    where lead_row.id = estimate_lead_id
      and (
        lead_row.user_id = auth.uid()
        or public.has_permission('leads.view_all')
        or public.has_permission('leads.update_all')
      )
  ) then
    raise exception 'O lead informado nao esta acessivel para sua conta.';
  end if;

  insert into public.steel_frame_estimates (
    lead_id,
    created_by,
    commercial_responsible_id,
    title,
    mode,
    city,
    neighborhood,
    approximate_address,
    project_type,
    standard_wall_height_meters,
    expected_floors,
    access_difficulty,
    requires_material_lift,
    notes,
    current_version_number
  ) values (
    estimate_lead_id,
    auth.uid(),
    auth.uid(),
    trim(estimate_title),
    estimate_mode,
    nullif(trim(estimate_city), ''),
    nullif(trim(estimate_neighborhood), ''),
    nullif(trim(estimate_approximate_address), ''),
    nullif(trim(estimate_project_type), ''),
    estimate_standard_wall_height_meters,
    estimate_expected_floors,
    estimate_access_difficulty,
    estimate_requires_material_lift,
    nullif(trim(estimate_notes), ''),
    1
  ) returning * into estimate_row;

  insert into public.steel_frame_estimate_versions (
    estimate_id,
    version_number,
    status,
    snapshot,
    created_by
  ) values (
    estimate_row.id,
    1,
    'draft',
    jsonb_build_object(
      'title', estimate_row.title,
      'mode', estimate_row.mode,
      'lead_id', estimate_row.lead_id,
      'city', estimate_row.city,
      'neighborhood', estimate_row.neighborhood,
      'project_type', estimate_row.project_type,
      'created_at', estimate_row.created_at
    ),
    auth.uid()
  );

  return estimate_row;
end;
$$;

create or replace function public.create_steel_frame_material(
  material_name text,
  material_category text,
  material_unit text,
  material_sku text default null,
  initial_unit_cost numeric default null
)
returns public.steel_frame_materials
language plpgsql
security definer
set search_path = public
as $$
declare
  material_row public.steel_frame_materials%rowtype;
begin
  if not public.can_manage_steel_frame_catalog() then
    raise exception 'Permissao insuficiente para gerenciar o catalogo Steel Frame.';
  end if;

  if char_length(trim(coalesce(material_name, ''))) < 2
    or char_length(trim(coalesce(material_category, ''))) < 2
    or char_length(trim(coalesce(material_unit, ''))) < 1 then
    raise exception 'Nome, categoria e unidade do material sao obrigatorios.';
  end if;

  if initial_unit_cost is not null and initial_unit_cost < 0 then
    raise exception 'O custo inicial nao pode ser negativo.';
  end if;

  if initial_unit_cost is not null and not (
    public.has_permission('estimates.manage_all')
    or public.has_permission('estimates.prices.manage')
  ) then
    raise exception 'Permissao insuficiente para cadastrar precos.';
  end if;

  insert into public.steel_frame_materials (
    created_by,
    sku,
    name,
    category,
    unit
  ) values (
    auth.uid(),
    nullif(trim(material_sku), ''),
    trim(material_name),
    trim(material_category),
    trim(material_unit)
  ) returning * into material_row;

  if initial_unit_cost is not null then
    insert into public.steel_frame_material_prices (
      material_id,
      unit_cost,
      created_by
    ) values (
      material_row.id,
      initial_unit_cost,
      auth.uid()
    );
  end if;

  return material_row;
end;
$$;

create or replace function public.approve_steel_frame_estimate(
  target_estimate_id uuid,
  review_notes text default null
)
returns public.steel_frame_estimates
language plpgsql
security definer
set search_path = public
as $$
declare
  estimate_row public.steel_frame_estimates%rowtype;
  version_row public.steel_frame_estimate_versions%rowtype;
begin
  if not public.can_approve_steel_frame_estimate(target_estimate_id) then
    raise exception 'Permissao insuficiente para aprovar este orcamento.';
  end if;

  select *
  into estimate_row
  from public.steel_frame_estimates
  where id = target_estimate_id
  for update;

  if not found then
    raise exception 'Orcamento nao encontrado.';
  end if;

  if estimate_row.status in ('approved', 'proposal_generated', 'sent', 'accepted', 'expired', 'cancelled') then
    raise exception 'Este orcamento ja esta aprovado ou encerrado.';
  end if;

  select *
  into version_row
  from public.steel_frame_estimate_versions
  where estimate_id = estimate_row.id
    and version_number = estimate_row.current_version_number
  for update;

  if not found then
    raise exception 'Nao foi encontrada a versao corrente do orcamento.';
  end if;

  update public.steel_frame_estimate_versions
  set
    status = 'approved',
    technical_review_notes = nullif(trim(coalesce(review_notes, '')), ''),
    approved_by = auth.uid(),
    approved_at = now(),
    frozen_at = now()
  where id = version_row.id;

  insert into public.steel_frame_approvals (
    estimate_id,
    estimate_version_id,
    approval_type,
    decision,
    notes,
    approved_by
  ) values (
    estimate_row.id,
    version_row.id,
    'technical_review',
    'approved',
    nullif(trim(coalesce(review_notes, '')), ''),
    auth.uid()
  );

  update public.steel_frame_estimates
  set status = 'approved'
  where id = estimate_row.id
  returning * into estimate_row;

  return estimate_row;
end;
$$;

create or replace function public.mark_steel_frame_proposal_generated(
  target_estimate_id uuid,
  target_document_id uuid
)
returns public.steel_frame_estimates
language plpgsql
security definer
set search_path = public
as $$
declare
  estimate_row public.steel_frame_estimates%rowtype;
  document_row public.steel_frame_documents%rowtype;
  version_id uuid;
begin
  if not public.can_generate_steel_frame_proposal(target_estimate_id) then
    raise exception 'Permissao insuficiente para gerar a proposta deste orcamento.';
  end if;

  select *
  into estimate_row
  from public.steel_frame_estimates
  where id = target_estimate_id
  for update;

  if not found then
    raise exception 'Orcamento nao encontrado.';
  end if;

  select id
  into version_id
  from public.steel_frame_estimate_versions
  where estimate_id = estimate_row.id
    and version_number = estimate_row.current_version_number;

  if version_id is null then
    raise exception 'Nao foi encontrada a versao corrente do orcamento.';
  end if;

  select *
  into document_row
  from public.steel_frame_documents
  where id = target_document_id
    and estimate_id = estimate_row.id
    and estimate_version_id = version_id
    and document_type = 'proposal'
    and visibility = 'internal'
    and uploaded_by = auth.uid()
  for update;

  if not found then
    raise exception 'O arquivo da proposta nao esta disponivel para confirmacao.';
  end if;

  update public.steel_frame_estimates
  set status = 'proposal_generated'
  where id = estimate_row.id
  returning * into estimate_row;

  insert into public.steel_frame_audit_logs (
    estimate_id,
    estimate_version_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    estimate_row.id,
    version_id,
    auth.uid(),
    'proposal_generated',
    'steel_frame_documents',
    document_row.id,
    jsonb_build_object('document_id', document_row.id, 'storage_path', document_row.storage_path)
  );

  return estimate_row;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'steel_frame_estimates',
    'steel_frame_estimate_versions',
    'steel_frame_documents',
    'steel_frame_ai_analysis_jobs',
    'steel_frame_ai_extractions',
    'steel_frame_ai_questions',
    'steel_frame_ai_corrections',
    'steel_frame_wall_segments',
    'steel_frame_openings',
    'steel_frame_suppliers',
    'steel_frame_materials',
    'steel_frame_material_prices',
    'steel_frame_assemblies',
    'steel_frame_assembly_items',
    'steel_frame_reinforcement_templates',
    'steel_frame_calculated_items',
    'steel_frame_labor_items',
    'steel_frame_operational_costs',
    'steel_frame_commercial_components',
    'steel_frame_approvals',
    'steel_frame_audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', target_table);
  end loop;
end;
$$;

drop policy if exists "steel_frame_estimates_select_authorized" on public.steel_frame_estimates;
drop policy if exists "steel_frame_estimates_insert_authorized" on public.steel_frame_estimates;
drop policy if exists "steel_frame_estimates_update_authorized" on public.steel_frame_estimates;
create policy "steel_frame_estimates_select_authorized" on public.steel_frame_estimates
for select using (public.can_access_steel_frame_estimate(id));
create policy "steel_frame_estimates_insert_authorized" on public.steel_frame_estimates
for insert with check (
  public.current_profile_is_active()
  and auth.uid() = created_by
  and public.has_permission('estimates.create')
);
create policy "steel_frame_estimates_update_authorized" on public.steel_frame_estimates
for update using (public.can_edit_steel_frame_estimate(id))
with check (public.can_edit_steel_frame_estimate(id));

drop policy if exists "steel_frame_estimate_versions_select_authorized" on public.steel_frame_estimate_versions;
drop policy if exists "steel_frame_estimate_versions_insert_authorized" on public.steel_frame_estimate_versions;
drop policy if exists "steel_frame_estimate_versions_update_authorized" on public.steel_frame_estimate_versions;
create policy "steel_frame_estimate_versions_select_authorized" on public.steel_frame_estimate_versions
for select using (public.can_read_steel_frame_financials(estimate_id));
create policy "steel_frame_estimate_versions_insert_authorized" on public.steel_frame_estimate_versions
for insert with check (
  auth.uid() = created_by
  and public.can_edit_steel_frame_estimate(estimate_id)
);
create policy "steel_frame_estimate_versions_update_authorized" on public.steel_frame_estimate_versions
for update using (public.can_edit_steel_frame_estimate(estimate_id))
with check (
  public.can_edit_steel_frame_estimate(estimate_id)
  and (
    status not in ('approved', 'proposal_generated', 'sent', 'accepted', 'expired', 'cancelled')
    or public.can_approve_steel_frame_estimate(estimate_id)
  )
);

drop policy if exists "steel_frame_documents_select_authorized" on public.steel_frame_documents;
drop policy if exists "steel_frame_documents_insert_authorized" on public.steel_frame_documents;
drop policy if exists "steel_frame_documents_update_authorized" on public.steel_frame_documents;
drop policy if exists "steel_frame_documents_delete_authorized" on public.steel_frame_documents;
create policy "steel_frame_documents_select_authorized" on public.steel_frame_documents
for select using (
  public.can_access_steel_frame_estimate(estimate_id)
  and (visibility <> 'internal' or public.can_read_steel_frame_financials(estimate_id))
);
create policy "steel_frame_documents_insert_authorized" on public.steel_frame_documents
for insert with check (
  auth.uid() = uploaded_by
  and (
    public.can_edit_steel_frame_estimate(estimate_id)
    or (
      document_type = 'proposal'
      and visibility = 'internal'
      and public.can_generate_steel_frame_proposal(estimate_id)
      and public.is_current_steel_frame_estimate_version(estimate_id, estimate_version_id)
    )
  )
);
create policy "steel_frame_documents_update_authorized" on public.steel_frame_documents
for update using (
  public.can_edit_steel_frame_estimate(estimate_id)
  or (
    document_type = 'proposal'
    and visibility = 'internal'
    and uploaded_by = auth.uid()
    and public.can_generate_steel_frame_proposal(estimate_id)
    and public.is_current_steel_frame_estimate_version(estimate_id, estimate_version_id)
  )
)
with check (
  public.can_edit_steel_frame_estimate(estimate_id)
  or (
    document_type = 'proposal'
    and visibility = 'internal'
    and uploaded_by = auth.uid()
    and public.can_generate_steel_frame_proposal(estimate_id)
    and public.is_current_steel_frame_estimate_version(estimate_id, estimate_version_id)
  )
);
create policy "steel_frame_documents_delete_authorized" on public.steel_frame_documents
for delete using (
  public.can_edit_steel_frame_estimate(estimate_id)
  or (
    document_type = 'proposal'
    and visibility = 'internal'
    and uploaded_by = auth.uid()
    and public.can_generate_steel_frame_proposal(estimate_id)
    and public.is_current_steel_frame_estimate_version(estimate_id, estimate_version_id)
  )
);

drop policy if exists "steel_frame_ai_jobs_select_authorized" on public.steel_frame_ai_analysis_jobs;
drop policy if exists "steel_frame_ai_jobs_insert_authorized" on public.steel_frame_ai_analysis_jobs;
drop policy if exists "steel_frame_ai_jobs_update_authorized" on public.steel_frame_ai_analysis_jobs;
create policy "steel_frame_ai_jobs_select_authorized" on public.steel_frame_ai_analysis_jobs
for select using (public.can_access_steel_frame_estimate(estimate_id));
create policy "steel_frame_ai_jobs_insert_authorized" on public.steel_frame_ai_analysis_jobs
for insert with check (
  auth.uid() = requested_by
  and public.can_edit_steel_frame_estimate(estimate_id)
);
create policy "steel_frame_ai_jobs_update_authorized" on public.steel_frame_ai_analysis_jobs
for update using (public.can_edit_steel_frame_estimate(estimate_id))
with check (public.can_edit_steel_frame_estimate(estimate_id));

drop policy if exists "steel_frame_ai_extractions_select_authorized" on public.steel_frame_ai_extractions;
drop policy if exists "steel_frame_ai_extractions_mutate_authorized" on public.steel_frame_ai_extractions;
create policy "steel_frame_ai_extractions_select_authorized" on public.steel_frame_ai_extractions
for select using (public.can_access_steel_frame_estimate(estimate_id));
create policy "steel_frame_ai_extractions_mutate_authorized" on public.steel_frame_ai_extractions
for all using (public.can_edit_steel_frame_estimate(estimate_id))
with check (public.can_edit_steel_frame_estimate(estimate_id));

drop policy if exists "steel_frame_ai_questions_select_authorized" on public.steel_frame_ai_questions;
drop policy if exists "steel_frame_ai_questions_mutate_authorized" on public.steel_frame_ai_questions;
create policy "steel_frame_ai_questions_select_authorized" on public.steel_frame_ai_questions
for select using (public.can_access_steel_frame_estimate(estimate_id));
create policy "steel_frame_ai_questions_mutate_authorized" on public.steel_frame_ai_questions
for all using (public.can_edit_steel_frame_estimate(estimate_id))
with check (public.can_edit_steel_frame_estimate(estimate_id));

drop policy if exists "steel_frame_ai_corrections_select_authorized" on public.steel_frame_ai_corrections;
drop policy if exists "steel_frame_ai_corrections_insert_authorized" on public.steel_frame_ai_corrections;
create policy "steel_frame_ai_corrections_select_authorized" on public.steel_frame_ai_corrections
for select using (public.can_access_steel_frame_estimate(estimate_id));
create policy "steel_frame_ai_corrections_insert_authorized" on public.steel_frame_ai_corrections
for insert with check (
  auth.uid() = corrected_by
  and public.can_edit_steel_frame_estimate(estimate_id)
);

drop policy if exists "steel_frame_wall_segments_select_authorized" on public.steel_frame_wall_segments;
drop policy if exists "steel_frame_wall_segments_mutate_authorized" on public.steel_frame_wall_segments;
create policy "steel_frame_wall_segments_select_authorized" on public.steel_frame_wall_segments
for select using (public.can_access_steel_frame_estimate(estimate_id));
create policy "steel_frame_wall_segments_mutate_authorized" on public.steel_frame_wall_segments
for all using (public.can_edit_steel_frame_estimate(estimate_id))
with check (public.can_edit_steel_frame_estimate(estimate_id));

drop policy if exists "steel_frame_openings_select_authorized" on public.steel_frame_openings;
drop policy if exists "steel_frame_openings_mutate_authorized" on public.steel_frame_openings;
create policy "steel_frame_openings_select_authorized" on public.steel_frame_openings
for select using (public.can_access_steel_frame_estimate(estimate_id));
create policy "steel_frame_openings_mutate_authorized" on public.steel_frame_openings
for all using (public.can_edit_steel_frame_estimate(estimate_id))
with check (public.can_edit_steel_frame_estimate(estimate_id));

drop policy if exists "steel_frame_suppliers_select_authorized" on public.steel_frame_suppliers;
drop policy if exists "steel_frame_suppliers_mutate_authorized" on public.steel_frame_suppliers;
create policy "steel_frame_suppliers_select_authorized" on public.steel_frame_suppliers
for select using (public.can_view_steel_frame_catalog());
create policy "steel_frame_suppliers_mutate_authorized" on public.steel_frame_suppliers
for all using (public.can_manage_steel_frame_catalog())
with check (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_materials_select_authorized" on public.steel_frame_materials;
drop policy if exists "steel_frame_materials_mutate_authorized" on public.steel_frame_materials;
create policy "steel_frame_materials_select_authorized" on public.steel_frame_materials
for select using (public.can_view_steel_frame_catalog());
create policy "steel_frame_materials_mutate_authorized" on public.steel_frame_materials
for all using (public.can_manage_steel_frame_catalog())
with check (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_material_prices_select_authorized" on public.steel_frame_material_prices;
drop policy if exists "steel_frame_material_prices_mutate_authorized" on public.steel_frame_material_prices;
create policy "steel_frame_material_prices_select_authorized" on public.steel_frame_material_prices
for select using (
  public.current_profile_is_active()
  and (
    public.has_permission('estimates.manage_all')
    or public.has_permission('estimates.prices.view')
    or public.has_permission('estimates.prices.manage')
  )
);
create policy "steel_frame_material_prices_mutate_authorized" on public.steel_frame_material_prices
for all using (
  public.current_profile_is_active()
  and (
    public.has_permission('estimates.manage_all')
    or public.has_permission('estimates.prices.manage')
  )
)
with check (
  public.current_profile_is_active()
  and (
    public.has_permission('estimates.manage_all')
    or public.has_permission('estimates.prices.manage')
  )
);

drop policy if exists "steel_frame_assemblies_select_authorized" on public.steel_frame_assemblies;
drop policy if exists "steel_frame_assemblies_mutate_authorized" on public.steel_frame_assemblies;
create policy "steel_frame_assemblies_select_authorized" on public.steel_frame_assemblies
for select using (public.can_view_steel_frame_catalog());
create policy "steel_frame_assemblies_mutate_authorized" on public.steel_frame_assemblies
for all using (public.can_manage_steel_frame_catalog())
with check (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_assembly_items_select_authorized" on public.steel_frame_assembly_items;
drop policy if exists "steel_frame_assembly_items_mutate_authorized" on public.steel_frame_assembly_items;
create policy "steel_frame_assembly_items_select_authorized" on public.steel_frame_assembly_items
for select using (public.can_view_steel_frame_catalog());
create policy "steel_frame_assembly_items_mutate_authorized" on public.steel_frame_assembly_items
for all using (public.can_manage_steel_frame_catalog())
with check (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_reinforcements_select_authorized" on public.steel_frame_reinforcement_templates;
drop policy if exists "steel_frame_reinforcements_mutate_authorized" on public.steel_frame_reinforcement_templates;
create policy "steel_frame_reinforcements_select_authorized" on public.steel_frame_reinforcement_templates
for select using (public.can_view_steel_frame_catalog());
create policy "steel_frame_reinforcements_mutate_authorized" on public.steel_frame_reinforcement_templates
for all using (public.can_manage_steel_frame_catalog())
with check (public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_calculated_items_select_authorized" on public.steel_frame_calculated_items;
drop policy if exists "steel_frame_calculated_items_mutate_authorized" on public.steel_frame_calculated_items;
create policy "steel_frame_calculated_items_select_authorized" on public.steel_frame_calculated_items
for select using (public.can_read_steel_frame_financials(estimate_id));
create policy "steel_frame_calculated_items_mutate_authorized" on public.steel_frame_calculated_items
for all using (
  public.can_edit_steel_frame_estimate(estimate_id)
  and public.can_read_steel_frame_financials(estimate_id)
)
with check (
  public.can_edit_steel_frame_estimate(estimate_id)
  and public.can_read_steel_frame_financials(estimate_id)
);

drop policy if exists "steel_frame_labor_items_select_authorized" on public.steel_frame_labor_items;
drop policy if exists "steel_frame_labor_items_mutate_authorized" on public.steel_frame_labor_items;
create policy "steel_frame_labor_items_select_authorized" on public.steel_frame_labor_items
for select using (public.can_read_steel_frame_financials(estimate_id));
create policy "steel_frame_labor_items_mutate_authorized" on public.steel_frame_labor_items
for all using (
  public.can_edit_steel_frame_estimate(estimate_id)
  and public.can_read_steel_frame_financials(estimate_id)
)
with check (
  public.can_edit_steel_frame_estimate(estimate_id)
  and public.can_read_steel_frame_financials(estimate_id)
);

drop policy if exists "steel_frame_operational_costs_select_authorized" on public.steel_frame_operational_costs;
drop policy if exists "steel_frame_operational_costs_mutate_authorized" on public.steel_frame_operational_costs;
create policy "steel_frame_operational_costs_select_authorized" on public.steel_frame_operational_costs
for select using (public.can_read_steel_frame_financials(estimate_id));
create policy "steel_frame_operational_costs_mutate_authorized" on public.steel_frame_operational_costs
for all using (
  public.can_edit_steel_frame_estimate(estimate_id)
  and public.can_read_steel_frame_financials(estimate_id)
)
with check (
  public.can_edit_steel_frame_estimate(estimate_id)
  and public.can_read_steel_frame_financials(estimate_id)
);

drop policy if exists "steel_frame_commercial_components_select_authorized" on public.steel_frame_commercial_components;
drop policy if exists "steel_frame_commercial_components_mutate_authorized" on public.steel_frame_commercial_components;
create policy "steel_frame_commercial_components_select_authorized" on public.steel_frame_commercial_components
for select using (public.can_read_steel_frame_financials(estimate_id));
create policy "steel_frame_commercial_components_mutate_authorized" on public.steel_frame_commercial_components
for all using (
  public.can_edit_steel_frame_estimate(estimate_id)
  and public.can_read_steel_frame_financials(estimate_id)
)
with check (
  public.can_edit_steel_frame_estimate(estimate_id)
  and public.can_read_steel_frame_financials(estimate_id)
);

drop policy if exists "steel_frame_approvals_select_authorized" on public.steel_frame_approvals;
drop policy if exists "steel_frame_approvals_insert_authorized" on public.steel_frame_approvals;
create policy "steel_frame_approvals_select_authorized" on public.steel_frame_approvals
for select using (public.can_access_steel_frame_estimate(estimate_id));
create policy "steel_frame_approvals_insert_authorized" on public.steel_frame_approvals
for insert with check (
  auth.uid() = approved_by
  and public.can_approve_steel_frame_estimate(estimate_id)
);

drop policy if exists "steel_frame_audit_logs_select_authorized" on public.steel_frame_audit_logs;
create policy "steel_frame_audit_logs_select_authorized" on public.steel_frame_audit_logs
for select using (
  public.can_access_steel_frame_estimate(estimate_id)
  and (
    public.has_permission('estimates.manage_all')
    or public.has_permission('estimates.audit.view')
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'steel-frame-documents',
  'steel-frame-documents',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "steel_frame_documents_storage_select" on storage.objects;
drop policy if exists "steel_frame_documents_storage_insert" on storage.objects;
drop policy if exists "steel_frame_documents_storage_delete" on storage.objects;
create policy "steel_frame_documents_storage_select" on storage.objects
for select using (
  bucket_id = 'steel-frame-documents'
  and exists (
    select 1
    from public.steel_frame_documents document_row
    where document_row.storage_path = name
      and public.can_access_steel_frame_estimate(document_row.estimate_id)
      and (
        document_row.visibility <> 'internal'
        or public.can_read_steel_frame_financials(document_row.estimate_id)
      )
  )
);
create policy "steel_frame_documents_storage_insert" on storage.objects
for insert with check (
  bucket_id = 'steel-frame-documents'
  and public.current_profile_is_active()
  and (storage.foldername(name))[1] = auth.uid()::text
  and (
    public.can_edit_steel_frame_estimate(
      case
        when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (storage.foldername(name))[2]::uuid
        else null
      end
    )
    or exists (
      select 1
      from public.steel_frame_documents document_row
      where document_row.storage_path = name
        and document_row.document_type = 'proposal'
        and document_row.visibility = 'internal'
        and document_row.uploaded_by = auth.uid()
        and public.can_generate_steel_frame_proposal(document_row.estimate_id)
    )
  )
);
create policy "steel_frame_documents_storage_delete" on storage.objects
for delete using (
  bucket_id = 'steel-frame-documents'
  and exists (
    select 1
    from public.steel_frame_documents document_row
    where document_row.storage_path = name
      and (
        public.can_edit_steel_frame_estimate(document_row.estimate_id)
        or (
          document_row.document_type = 'proposal'
          and document_row.visibility = 'internal'
          and document_row.uploaded_by = auth.uid()
          and public.can_generate_steel_frame_proposal(document_row.estimate_id)
        )
      )
  )
);

grant select, insert, update, delete on table
  public.steel_frame_estimates,
  public.steel_frame_estimate_versions,
  public.steel_frame_documents,
  public.steel_frame_ai_analysis_jobs,
  public.steel_frame_ai_extractions,
  public.steel_frame_ai_questions,
  public.steel_frame_ai_corrections,
  public.steel_frame_wall_segments,
  public.steel_frame_openings,
  public.steel_frame_suppliers,
  public.steel_frame_materials,
  public.steel_frame_material_prices,
  public.steel_frame_assemblies,
  public.steel_frame_assembly_items,
  public.steel_frame_reinforcement_templates,
  public.steel_frame_calculated_items,
  public.steel_frame_labor_items,
  public.steel_frame_operational_costs,
  public.steel_frame_commercial_components,
  public.steel_frame_approvals,
  public.steel_frame_audit_logs
to authenticated;

grant execute on function public.can_access_steel_frame_estimate(uuid) to authenticated;
grant execute on function public.can_edit_steel_frame_estimate(uuid) to authenticated;
grant execute on function public.can_read_steel_frame_financials(uuid) to authenticated;
grant execute on function public.can_view_steel_frame_catalog() to authenticated;
grant execute on function public.can_manage_steel_frame_catalog() to authenticated;
grant execute on function public.can_approve_steel_frame_estimate(uuid) to authenticated;
grant execute on function public.can_generate_steel_frame_proposal(uuid) to authenticated;
grant execute on function public.is_current_steel_frame_estimate_version(uuid, uuid) to authenticated;
revoke all on function public.can_access_steel_frame_estimate(uuid) from public;
revoke all on function public.can_edit_steel_frame_estimate(uuid) from public;
revoke all on function public.can_read_steel_frame_financials(uuid) from public;
revoke all on function public.can_view_steel_frame_catalog() from public;
revoke all on function public.can_manage_steel_frame_catalog() from public;
revoke all on function public.can_approve_steel_frame_estimate(uuid) from public;
revoke all on function public.can_generate_steel_frame_proposal(uuid) from public;
revoke all on function public.is_current_steel_frame_estimate_version(uuid, uuid) from public;
revoke all on function public.create_steel_frame_estimate(text, text, uuid, text, text, text, text, numeric, integer, text, boolean, text) from public;
revoke all on function public.create_steel_frame_material(text, text, text, text, numeric) from public;
revoke all on function public.approve_steel_frame_estimate(uuid, text) from public;
revoke all on function public.mark_steel_frame_proposal_generated(uuid, uuid) from public;
revoke all on function public.set_steel_frame_updated_at() from public;
revoke all on function public.guard_steel_frame_version_mutation() from public;
revoke all on function public.guard_steel_frame_version_content_mutation() from public;
revoke all on function public.audit_steel_frame_estimate_change() from public;
grant execute on function public.create_steel_frame_estimate(text, text, uuid, text, text, text, text, numeric, integer, text, boolean, text) to authenticated;
grant execute on function public.create_steel_frame_material(text, text, text, text, numeric) to authenticated;
grant execute on function public.approve_steel_frame_estimate(uuid, text) to authenticated;
grant execute on function public.mark_steel_frame_proposal_generated(uuid, uuid) to authenticated;
