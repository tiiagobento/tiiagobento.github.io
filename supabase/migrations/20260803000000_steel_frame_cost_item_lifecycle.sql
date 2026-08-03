-- Nova Forma CRM: safe lifecycle for Steel Frame cost items.
-- Additive and idempotent. Archived rows remain available for audit and
-- approved/frozen versions continue protected by the existing version guard.

alter table public.steel_frame_calculated_items
  add column if not exists archived_at timestamp with time zone,
  add column if not exists archived_by uuid references public.profiles(id) on delete restrict,
  add column if not exists archive_reason text;

alter table public.steel_frame_labor_items
  add column if not exists archived_at timestamp with time zone,
  add column if not exists archived_by uuid references public.profiles(id) on delete restrict,
  add column if not exists archive_reason text;

alter table public.steel_frame_operational_costs
  add column if not exists archived_at timestamp with time zone,
  add column if not exists archived_by uuid references public.profiles(id) on delete restrict,
  add column if not exists archive_reason text;

do $$
declare
  target_table text;
  constraint_name text;
begin
  foreach target_table in array array[
    'steel_frame_calculated_items',
    'steel_frame_labor_items',
    'steel_frame_operational_costs'
  ] loop
    constraint_name := target_table || '_archive_state_check';
    if not exists (
      select 1
      from pg_constraint
      where conname = constraint_name
        and conrelid = format('public.%I', target_table)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check (
          (archived_at is null and archived_by is null and archive_reason is null)
          or
          (archived_at is not null and archived_by is not null and nullif(btrim(archive_reason), '''') is not null)
        )',
        target_table,
        constraint_name
      );
    end if;
  end loop;
end;
$$;

create index if not exists steel_frame_calculated_items_active_estimate_idx
  on public.steel_frame_calculated_items(estimate_id, sort_order)
  where archived_at is null;

create index if not exists steel_frame_labor_items_active_estimate_idx
  on public.steel_frame_labor_items(estimate_id, sort_order)
  where archived_at is null;

create index if not exists steel_frame_operational_costs_active_estimate_idx
  on public.steel_frame_operational_costs(estimate_id, sort_order)
  where archived_at is null;

create or replace function public.audit_steel_frame_cost_item_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row jsonb;
  after_row jsonb;
  target_estimate_id uuid;
  target_version_id uuid;
  target_entity_id uuid;
  audit_action text;
begin
  before_row := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_row := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  target_estimate_id := case when tg_op = 'DELETE' then old.estimate_id else new.estimate_id end;
  target_version_id := case when tg_op = 'DELETE' then old.estimate_version_id else new.estimate_version_id end;
  target_entity_id := case when tg_op = 'DELETE' then old.id else new.id end;

  audit_action := case
    when tg_op = 'INSERT' then 'cost_item.created'
    when tg_op = 'DELETE' then 'cost_item.deleted'
    when old.archived_at is null and new.archived_at is not null then 'cost_item.archived'
    else 'cost_item.updated'
  end;

  insert into public.steel_frame_audit_logs (
    estimate_id,
    estimate_version_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    target_estimate_id,
    target_version_id,
    auth.uid(),
    audit_action,
    tg_table_name,
    target_entity_id,
    before_row,
    after_row,
    jsonb_build_object('source', 'cost_item_lifecycle')
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'steel_frame_calculated_items',
    'steel_frame_labor_items',
    'steel_frame_operational_costs'
  ] loop
    execute format('drop trigger if exists %I on public.%I', target_table || '_audit', target_table);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_steel_frame_cost_item_change()',
      target_table || '_audit',
      target_table
    );
  end loop;
end;
$$;

revoke all on function public.audit_steel_frame_cost_item_change() from public;

comment on function public.audit_steel_frame_cost_item_change() is
  'Records insert, update, archive and exceptional delete events for Steel Frame cost items.';
