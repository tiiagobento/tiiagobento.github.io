-- Nova Forma CRM: immutable supplier quote history for Steel Frame Phase 2.
--
-- This migration is additive. It depends on the approved Steel Frame baseline
-- and the Phase 2 catalog foundation. It never creates catalog prices, rules,
-- coefficients, suppliers, or materials automatically.
--
-- Apply only after the existing Phase 2 catalog migration has completed.

do $$
declare
  required_relation text;
begin
  foreach required_relation in array array[
    'profiles',
    'steel_frame_suppliers',
    'steel_frame_materials',
    'steel_frame_technical_sources',
    'steel_frame_technical_source_documents',
    'steel_frame_catalog_audit_logs'
  ] loop
    if to_regclass(format('public.%I', required_relation)) is null then
      raise exception
        'Supplier quote history requires the Steel Frame Phase 2 catalog foundation: public.% is missing.',
        required_relation;
    end if;
  end loop;

  if to_regprocedure('public.can_manage_steel_frame_catalog()') is null
    or to_regprocedure('public.write_steel_frame_catalog_audit()') is null then
    raise exception 'Supplier quote history requires the catalog authorization and audit functions.';
  end if;
end;
$$;

create table if not exists public.steel_frame_supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  source_id uuid not null references public.steel_frame_technical_sources(id) on delete restrict,
  source_document_id uuid not null references public.steel_frame_technical_source_documents(id) on delete restrict,
  supplier_id uuid references public.steel_frame_suppliers(id) on delete set null,
  supplier_name_snapshot text not null,
  supplier_tax_id_snapshot text,
  supplier_contact_name_snapshot text,
  supplier_contact_phone_snapshot text,
  supplier_contact_email_snapshot text,
  quote_number text,
  issued_on date,
  valid_until date,
  expected_billing_on date,
  payment_terms text,
  subtotal numeric(14, 2) check (subtotal is null or subtotal >= 0),
  discount numeric(14, 2) check (discount is null or discount >= 0),
  freight numeric(14, 2) check (freight is null or freight >= 0),
  taxes numeric(14, 2) check (taxes is null or taxes >= 0),
  total numeric(14, 2) not null check (total >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  notes text,
  status text not null default 'captured' check (status in ('captured', 'archived')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  check (valid_until is null or issued_on is null or valid_until >= issued_on),
  unique nulls not distinct (source_document_id)
);

create table if not exists public.steel_frame_supplier_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.steel_frame_supplier_quotes(id) on delete restrict,
  source_line_number integer not null check (source_line_number > 0),
  external_code text,
  description text not null,
  ncm text,
  quantity numeric(14, 4) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(14, 4) not null check (unit_price >= 0),
  line_total numeric(14, 2) not null check (line_total >= 0),
  material_id uuid references public.steel_frame_materials(id) on delete set null,
  material_variant_id uuid references public.steel_frame_material_variants(id) on delete set null,
  matching_status text not null default 'unmatched' check (matching_status in ('unmatched', 'suggested', 'confirmed', 'not_applicable')),
  created_at timestamp with time zone not null default now(),
  unique (quote_id, source_line_number)
);

create index if not exists steel_frame_supplier_quotes_source_idx
  on public.steel_frame_supplier_quotes(source_id, created_at desc);
create index if not exists steel_frame_supplier_quotes_supplier_idx
  on public.steel_frame_supplier_quotes(supplier_id, created_at desc);
create index if not exists steel_frame_supplier_quote_items_quote_idx
  on public.steel_frame_supplier_quote_items(quote_id, source_line_number);
create index if not exists steel_frame_supplier_quote_items_material_idx
  on public.steel_frame_supplier_quote_items(material_id);

create or replace function public.validate_steel_frame_supplier_quote_source()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.steel_frame_technical_sources source_row
    join public.steel_frame_technical_source_documents document_row
      on document_row.source_id = source_row.id
    where source_row.id = new.source_id
      and source_row.source_type = 'supplier_quote'
      and document_row.id = new.source_document_id
  ) then
    raise exception 'A cotacao deve referenciar um documento privado de uma fonte do tipo supplier_quote.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_steel_frame_supplier_quote_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Cotacoes de fornecedor sao historicas e imutaveis. Registre uma nova cotacao para corrigir ou atualizar valores.';
  end if;
  return new;
end;
$$;

drop trigger if exists steel_frame_supplier_quotes_source_guard on public.steel_frame_supplier_quotes;
create trigger steel_frame_supplier_quotes_source_guard
before insert or update on public.steel_frame_supplier_quotes
for each row execute function public.validate_steel_frame_supplier_quote_source();

drop trigger if exists steel_frame_supplier_quotes_immutable on public.steel_frame_supplier_quotes;
create trigger steel_frame_supplier_quotes_immutable
before insert or update or delete on public.steel_frame_supplier_quotes
for each row execute function public.guard_steel_frame_supplier_quote_mutation();

drop trigger if exists steel_frame_supplier_quote_items_immutable on public.steel_frame_supplier_quote_items;
create trigger steel_frame_supplier_quote_items_immutable
before insert or update or delete on public.steel_frame_supplier_quote_items
for each row execute function public.guard_steel_frame_supplier_quote_mutation();

drop trigger if exists steel_frame_supplier_quotes_audit on public.steel_frame_supplier_quotes;
create trigger steel_frame_supplier_quotes_audit
after insert on public.steel_frame_supplier_quotes
for each row execute function public.write_steel_frame_catalog_audit();

drop trigger if exists steel_frame_supplier_quote_items_audit on public.steel_frame_supplier_quote_items;
create trigger steel_frame_supplier_quote_items_audit
after insert on public.steel_frame_supplier_quote_items
for each row execute function public.write_steel_frame_catalog_audit();

create or replace function public.create_steel_frame_supplier_quote(
  quote_payload jsonb,
  item_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_quote public.steel_frame_supplier_quotes;
begin
  if not public.can_manage_steel_frame_catalog() then
    raise exception 'Voce nao possui permissao para registrar cotacoes de fornecedor.';
  end if;
  if jsonb_typeof(quote_payload) <> 'object' then
    raise exception 'Os dados da cotacao devem ser um objeto JSON.';
  end if;
  if jsonb_typeof(item_payload) <> 'array' or jsonb_array_length(item_payload) = 0 then
    raise exception 'Inclua pelo menos um item revisado na cotacao.';
  end if;

  insert into public.steel_frame_supplier_quotes (
    source_id,
    source_document_id,
    supplier_id,
    supplier_name_snapshot,
    supplier_tax_id_snapshot,
    supplier_contact_name_snapshot,
    supplier_contact_phone_snapshot,
    supplier_contact_email_snapshot,
    quote_number,
    issued_on,
    valid_until,
    expected_billing_on,
    payment_terms,
    subtotal,
    discount,
    freight,
    taxes,
    total,
    currency,
    notes
  ) values (
    (quote_payload ->> 'source_id')::uuid,
    (quote_payload ->> 'source_document_id')::uuid,
    nullif(quote_payload ->> 'supplier_id', '')::uuid,
    trim(quote_payload ->> 'supplier_name_snapshot'),
    nullif(trim(quote_payload ->> 'supplier_tax_id_snapshot'), ''),
    nullif(trim(quote_payload ->> 'supplier_contact_name_snapshot'), ''),
    nullif(trim(quote_payload ->> 'supplier_contact_phone_snapshot'), ''),
    nullif(trim(quote_payload ->> 'supplier_contact_email_snapshot'), ''),
    nullif(trim(quote_payload ->> 'quote_number'), ''),
    nullif(quote_payload ->> 'issued_on', '')::date,
    nullif(quote_payload ->> 'valid_until', '')::date,
    nullif(quote_payload ->> 'expected_billing_on', '')::date,
    nullif(trim(quote_payload ->> 'payment_terms'), ''),
    nullif(quote_payload ->> 'subtotal', '')::numeric,
    nullif(quote_payload ->> 'discount', '')::numeric,
    nullif(quote_payload ->> 'freight', '')::numeric,
    nullif(quote_payload ->> 'taxes', '')::numeric,
    (quote_payload ->> 'total')::numeric,
    coalesce(nullif(quote_payload ->> 'currency', ''), 'BRL'),
    nullif(trim(quote_payload ->> 'notes'), '')
  ) returning * into created_quote;

  insert into public.steel_frame_supplier_quote_items (
    quote_id,
    source_line_number,
    external_code,
    description,
    ncm,
    quantity,
    unit,
    unit_price,
    line_total,
    material_id,
    material_variant_id,
    matching_status
  )
  select
    created_quote.id,
    item.source_line_number,
    nullif(trim(item.external_code), ''),
    trim(item.description),
    nullif(trim(item.ncm), ''),
    item.quantity,
    trim(item.unit),
    item.unit_price,
    item.line_total,
    item.material_id,
    item.material_variant_id,
    coalesce(nullif(item.matching_status, ''), 'unmatched')
  from jsonb_to_recordset(item_payload) as item(
    source_line_number integer,
    external_code text,
    description text,
    ncm text,
    quantity numeric,
    unit text,
    unit_price numeric,
    line_total numeric,
    material_id uuid,
    material_variant_id uuid,
    matching_status text
  );

  return created_quote.id;
end;
$$;

alter table public.steel_frame_supplier_quotes enable row level security;
alter table public.steel_frame_supplier_quote_items enable row level security;

drop policy if exists "steel_frame_supplier_quotes_select_manage" on public.steel_frame_supplier_quotes;
create policy "steel_frame_supplier_quotes_select_manage" on public.steel_frame_supplier_quotes
for select using (public.can_manage_steel_frame_catalog());
drop policy if exists "steel_frame_supplier_quotes_insert_manage" on public.steel_frame_supplier_quotes;
create policy "steel_frame_supplier_quotes_insert_manage" on public.steel_frame_supplier_quotes
for insert with check (created_by = auth.uid() and public.can_manage_steel_frame_catalog());

drop policy if exists "steel_frame_supplier_quote_items_select_manage" on public.steel_frame_supplier_quote_items;
create policy "steel_frame_supplier_quote_items_select_manage" on public.steel_frame_supplier_quote_items
for select using (
  exists (
    select 1
    from public.steel_frame_supplier_quotes quote_row
    where quote_row.id = quote_id
      and public.can_manage_steel_frame_catalog()
  )
);
drop policy if exists "steel_frame_supplier_quote_items_insert_manage" on public.steel_frame_supplier_quote_items;
create policy "steel_frame_supplier_quote_items_insert_manage" on public.steel_frame_supplier_quote_items
for insert with check (public.can_manage_steel_frame_catalog());

grant select, insert on table
  public.steel_frame_supplier_quotes,
  public.steel_frame_supplier_quote_items
to authenticated;

revoke all on function public.validate_steel_frame_supplier_quote_source() from public;
revoke all on function public.guard_steel_frame_supplier_quote_mutation() from public;
revoke all on function public.create_steel_frame_supplier_quote(jsonb, jsonb) from public;
grant execute on function public.create_steel_frame_supplier_quote(jsonb, jsonb) to authenticated;

comment on table public.steel_frame_supplier_quotes is 'Immutable, review-confirmed supplier quote headers. A quote never creates a catalog price automatically.';
comment on table public.steel_frame_supplier_quote_items is 'Immutable historical supplier quote lines. Material matches require explicit human confirmation.';
