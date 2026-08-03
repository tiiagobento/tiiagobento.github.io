-- Audited commercial lifecycle for generic Steel Frame materials and prices.
-- This migration is additive: it never deletes materials or historical prices.

alter table public.steel_frame_materials
  add column if not exists archived_at timestamp with time zone,
  add column if not exists archived_by uuid references public.profiles(id) on delete restrict,
  add column if not exists archive_reason text;

alter table public.steel_frame_materials
  drop constraint if exists steel_frame_materials_archive_contract_check;
alter table public.steel_frame_materials
  add constraint steel_frame_materials_archive_contract_check
  check (
    (archived_at is null and archived_by is null and archive_reason is null)
    or (
      not active
      and archived_at is not null
      and archived_by is not null
      and char_length(trim(archive_reason)) >= 3
    )
  ) not valid;
alter table public.steel_frame_materials
  validate constraint steel_frame_materials_archive_contract_check;

create index if not exists steel_frame_materials_active_category_idx
  on public.steel_frame_materials(category, name)
  where active;

drop trigger if exists steel_frame_materials_catalog_audit on public.steel_frame_materials;
create trigger steel_frame_materials_catalog_audit
after insert or update or delete on public.steel_frame_materials
for each row execute function public.write_steel_frame_catalog_audit();

drop trigger if exists steel_frame_material_prices_catalog_audit on public.steel_frame_material_prices;
create trigger steel_frame_material_prices_catalog_audit
after insert or update or delete on public.steel_frame_material_prices
for each row execute function public.write_steel_frame_catalog_audit();

create or replace function public.update_steel_frame_material(
  target_material_id uuid,
  material_name text,
  material_category text,
  material_unit text,
  material_sku text default null
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

  select * into material_row
  from public.steel_frame_materials
  where id = target_material_id
  for update;

  if not found then
    raise exception 'Material nao encontrado.';
  end if;
  if not material_row.active then
    raise exception 'Material arquivado nao pode ser alterado.';
  end if;

  update public.steel_frame_materials
  set
    name = trim(material_name),
    category = trim(material_category),
    unit = trim(material_unit),
    sku = nullif(trim(material_sku), '')
  where id = target_material_id
  returning * into material_row;

  return material_row;
end;
$$;

create or replace function public.archive_steel_frame_material(
  target_material_id uuid,
  archive_reason text
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
  if char_length(trim(coalesce(archive_reason, ''))) < 3 then
    raise exception 'Informe o motivo do arquivamento.';
  end if;

  select * into material_row
  from public.steel_frame_materials
  where id = target_material_id
  for update;

  if not found then
    raise exception 'Material nao encontrado.';
  end if;
  if not material_row.active then
    raise exception 'Este material ja esta arquivado.';
  end if;

  update public.steel_frame_materials
  set
    active = false,
    archived_at = now(),
    archived_by = auth.uid(),
    archive_reason = trim(archive_reason)
  where id = target_material_id
  returning * into material_row;

  return material_row;
end;
$$;

create or replace function public.register_steel_frame_material_price(
  target_material_id uuid,
  new_unit_cost numeric,
  price_effective_from date,
  price_source_reference text
)
returns public.steel_frame_material_prices
language plpgsql
security definer
set search_path = public
as $$
declare
  material_row public.steel_frame_materials%rowtype;
  price_row public.steel_frame_material_prices%rowtype;
  newest_effective_from date;
begin
  if not public.current_profile_is_active() or not (
    public.has_permission('estimates.manage_all')
    or public.has_permission('estimates.prices.manage')
  ) then
    raise exception 'Permissao insuficiente para cadastrar precos.';
  end if;
  if new_unit_cost is null or new_unit_cost < 0 then
    raise exception 'Informe um custo unitario valido.';
  end if;
  if price_effective_from is null then
    raise exception 'Informe a data de vigencia do preco.';
  end if;
  if char_length(trim(coalesce(price_source_reference, ''))) < 3 then
    raise exception 'Informe a fonte do preco.';
  end if;

  select * into material_row
  from public.steel_frame_materials
  where id = target_material_id
  for update;

  if not found then
    raise exception 'Material nao encontrado.';
  end if;
  if not material_row.active then
    raise exception 'Nao e possivel cadastrar preco para material arquivado.';
  end if;

  select max(effective_from) into newest_effective_from
  from public.steel_frame_material_prices
  where material_id = target_material_id
    and material_variant_id is null;

  if newest_effective_from is not null and price_effective_from < newest_effective_from then
    raise exception 'A nova vigencia nao pode ser anterior ao preco mais recente.';
  end if;

  update public.steel_frame_material_prices
  set
    effective_to = case
      when effective_from < price_effective_from then price_effective_from - 1
      else price_effective_from
    end,
    preferred = false
  where material_id = target_material_id
    and material_variant_id is null
    and effective_to is null;

  insert into public.steel_frame_material_prices (
    material_id,
    unit_cost,
    currency,
    effective_from,
    effective_to,
    source_reference,
    preferred,
    created_by
  ) values (
    target_material_id,
    new_unit_cost,
    'BRL',
    price_effective_from,
    null,
    trim(price_source_reference),
    true,
    auth.uid()
  ) returning * into price_row;

  return price_row;
end;
$$;

grant execute on function public.update_steel_frame_material(uuid, text, text, text, text) to authenticated;
grant execute on function public.archive_steel_frame_material(uuid, text) to authenticated;
grant execute on function public.register_steel_frame_material_price(uuid, numeric, date, text) to authenticated;

revoke all on function public.update_steel_frame_material(uuid, text, text, text, text) from public;
revoke all on function public.archive_steel_frame_material(uuid, text) from public;
revoke all on function public.register_steel_frame_material_price(uuid, numeric, date, text) from public;

comment on function public.register_steel_frame_material_price(uuid, numeric, date, text) is
  'Closes the current generic material price and creates a new preferred price without deleting history.';
