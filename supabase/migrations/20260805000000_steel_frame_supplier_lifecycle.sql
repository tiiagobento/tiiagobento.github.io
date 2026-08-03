-- Audited lifecycle for Steel Frame suppliers.
-- Additive only: historic suppliers, quotes, materials and prices are preserved.

alter table public.steel_frame_suppliers
  add column if not exists archived_at timestamp with time zone,
  add column if not exists archived_by uuid references public.profiles(id) on delete restrict,
  add column if not exists archive_reason text;

create index if not exists steel_frame_suppliers_active_name_idx
  on public.steel_frame_suppliers(name)
  where active;

create or replace function public.guard_steel_frame_supplier_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Fornecedores possuem historico comercial e nao podem ser excluidos. Arquive o fornecedor.';
  end if;

  if tg_op = 'INSERT' then
    if not new.active or new.archived_at is not null or new.archived_by is not null or new.archive_reason is not null then
      raise exception 'Novos fornecedores devem iniciar ativos e sem dados de arquivamento.';
    end if;
    return new;
  end if;

  if not old.active then
    raise exception 'Fornecedores arquivados sao imutaveis.';
  end if;

  if new.active then
    if new.archived_at is not null or new.archived_by is not null or new.archive_reason is not null then
      raise exception 'Fornecedor ativo nao pode possuir dados de arquivamento.';
    end if;
    return new;
  end if;

  if new.archived_at is null
    or new.archived_by is null
    or char_length(trim(coalesce(new.archive_reason, ''))) < 3 then
    raise exception 'O arquivamento exige autor, data e motivo.';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.steel_frame_suppliers'::regclass
      and tgname = 'steel_frame_suppliers_lifecycle_guard'
      and not tgisinternal
  ) then
    create trigger steel_frame_suppliers_lifecycle_guard
    before insert or update or delete on public.steel_frame_suppliers
    for each row execute function public.guard_steel_frame_supplier_lifecycle();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.steel_frame_suppliers'::regclass
      and tgname = 'steel_frame_suppliers_catalog_audit'
      and not tgisinternal
  ) then
    create trigger steel_frame_suppliers_catalog_audit
    after insert or update or delete on public.steel_frame_suppliers
    for each row execute function public.write_steel_frame_catalog_audit();
  end if;
end;
$$;

create or replace function public.create_steel_frame_supplier(
  supplier_name text,
  supplier_tax_id text default null,
  supplier_contact_name text default null,
  supplier_phone text default null,
  supplier_email text default null,
  supplier_notes text default null
)
returns public.steel_frame_suppliers
language plpgsql
security definer
set search_path = public
as $$
declare
  supplier_row public.steel_frame_suppliers%rowtype;
begin
  if not public.can_manage_steel_frame_catalog() then
    raise exception 'Permissao insuficiente para gerenciar fornecedores Steel Frame.';
  end if;
  if char_length(trim(coalesce(supplier_name, ''))) < 2 then
    raise exception 'Informe o nome do fornecedor.';
  end if;

  insert into public.steel_frame_suppliers (
    name,
    tax_id,
    contact_name,
    phone,
    email,
    notes,
    active,
    created_by
  ) values (
    trim(supplier_name),
    nullif(trim(supplier_tax_id), ''),
    nullif(trim(supplier_contact_name), ''),
    nullif(trim(supplier_phone), ''),
    nullif(lower(trim(supplier_email)), ''),
    nullif(trim(supplier_notes), ''),
    true,
    auth.uid()
  ) returning * into supplier_row;

  return supplier_row;
end;
$$;

create or replace function public.update_steel_frame_supplier(
  target_supplier_id uuid,
  supplier_name text,
  supplier_tax_id text default null,
  supplier_contact_name text default null,
  supplier_phone text default null,
  supplier_email text default null,
  supplier_notes text default null
)
returns public.steel_frame_suppliers
language plpgsql
security definer
set search_path = public
as $$
declare
  supplier_row public.steel_frame_suppliers%rowtype;
begin
  if not public.can_manage_steel_frame_catalog() then
    raise exception 'Permissao insuficiente para gerenciar fornecedores Steel Frame.';
  end if;
  if char_length(trim(coalesce(supplier_name, ''))) < 2 then
    raise exception 'Informe o nome do fornecedor.';
  end if;

  select * into supplier_row
  from public.steel_frame_suppliers
  where id = target_supplier_id
  for update;

  if not found then
    raise exception 'Fornecedor nao encontrado.';
  end if;
  if not supplier_row.active then
    raise exception 'Fornecedor arquivado nao pode ser alterado.';
  end if;

  update public.steel_frame_suppliers
  set
    name = trim(supplier_name),
    tax_id = nullif(trim(supplier_tax_id), ''),
    contact_name = nullif(trim(supplier_contact_name), ''),
    phone = nullif(trim(supplier_phone), ''),
    email = nullif(lower(trim(supplier_email)), ''),
    notes = nullif(trim(supplier_notes), '')
  where id = target_supplier_id
  returning * into supplier_row;

  return supplier_row;
end;
$$;

create or replace function public.archive_steel_frame_supplier(
  target_supplier_id uuid,
  archive_reason_text text
)
returns public.steel_frame_suppliers
language plpgsql
security definer
set search_path = public
as $$
declare
  supplier_row public.steel_frame_suppliers%rowtype;
begin
  if not public.can_manage_steel_frame_catalog() then
    raise exception 'Permissao insuficiente para gerenciar fornecedores Steel Frame.';
  end if;
  if char_length(trim(coalesce(archive_reason_text, ''))) < 3 then
    raise exception 'Informe o motivo do arquivamento.';
  end if;

  select * into supplier_row
  from public.steel_frame_suppliers
  where id = target_supplier_id
  for update;

  if not found then
    raise exception 'Fornecedor nao encontrado.';
  end if;
  if not supplier_row.active then
    raise exception 'Este fornecedor ja esta arquivado.';
  end if;

  update public.steel_frame_suppliers
  set
    active = false,
    archived_at = now(),
    archived_by = auth.uid(),
    archive_reason = trim(archive_reason_text)
  where id = target_supplier_id
  returning * into supplier_row;

  return supplier_row;
end;
$$;

grant execute on function public.create_steel_frame_supplier(text, text, text, text, text, text) to authenticated;
grant execute on function public.update_steel_frame_supplier(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.archive_steel_frame_supplier(uuid, text) to authenticated;

revoke all on function public.create_steel_frame_supplier(text, text, text, text, text, text) from public;
revoke all on function public.update_steel_frame_supplier(uuid, text, text, text, text, text, text) from public;
revoke all on function public.archive_steel_frame_supplier(uuid, text) from public;

comment on function public.archive_steel_frame_supplier(uuid, text) is
  'Archives a supplier while preserving quote, material and price references and writing catalog audit history.';
