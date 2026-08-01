-- Nova Forma CRM - Steel Frame Phase 2 catalog postflight
--
-- Read-only script. Run this only in the confirmed homologation project after
-- applying 20260801000000_steel_frame_phase_2_catalog_foundation.sql.
-- It never changes schema, data, storage, policies, permissions, or files.

with
  expected_tables(table_name) as (
    values
      ('steel_frame_technical_sources'),
      ('steel_frame_technical_source_documents'),
      ('steel_frame_material_variants'),
      ('steel_frame_material_coefficients'),
      ('steel_frame_material_compatibilities'),
      ('steel_frame_technical_composition_layers'),
      ('steel_frame_estimate_scenarios'),
      ('steel_frame_catalog_snapshots'),
      ('steel_frame_catalog_audit_logs')
  ),
  expected_columns(table_name, column_name) as (
    values
      ('steel_frame_technical_rules', 'strategy_type'),
      ('steel_frame_technical_rules', 'source_id'),
      ('steel_frame_technical_rules', 'source_document_id'),
      ('steel_frame_technical_compositions', 'source_id'),
      ('steel_frame_technical_compositions', 'source_document_id'),
      ('steel_frame_material_prices', 'material_variant_id'),
      ('steel_frame_material_prices', 'preferred'),
      ('steel_frame_reinforcement_templates', 'status'),
      ('steel_frame_reinforcement_templates', 'source_id')
  ),
  expected_policies(table_name, policy_name) as (
    values
      ('steel_frame_technical_sources', 'steel_frame_technical_sources_manage'),
      ('steel_frame_technical_source_documents', 'steel_frame_technical_source_documents_manage'),
      ('steel_frame_material_variants', 'steel_frame_material_variants_select_authorized'),
      ('steel_frame_material_variants', 'steel_frame_material_variants_manage'),
      ('steel_frame_material_coefficients', 'steel_frame_material_coefficients_select_authorized'),
      ('steel_frame_material_coefficients', 'steel_frame_material_coefficients_manage'),
      ('steel_frame_material_compatibilities', 'steel_frame_material_compatibilities_select_authorized'),
      ('steel_frame_material_compatibilities', 'steel_frame_material_compatibilities_manage'),
      ('steel_frame_technical_composition_layers', 'steel_frame_technical_composition_layers_select_authorized'),
      ('steel_frame_technical_composition_layers', 'steel_frame_technical_composition_layers_manage'),
      ('steel_frame_estimate_scenarios', 'steel_frame_estimate_scenarios_select_authorized'),
      ('steel_frame_estimate_scenarios', 'steel_frame_estimate_scenarios_insert_authorized'),
      ('steel_frame_catalog_snapshots', 'steel_frame_catalog_snapshots_select_authorized'),
      ('steel_frame_catalog_snapshots', 'steel_frame_catalog_snapshots_insert_authorized'),
      ('steel_frame_catalog_audit_logs', 'steel_frame_catalog_audit_logs_select_manage')
  ),
  expected_triggers(table_name, trigger_name) as (
    values
      ('steel_frame_technical_sources', 'steel_frame_technical_sources_guard'),
      ('steel_frame_technical_sources', 'steel_frame_technical_sources_updated_at'),
      ('steel_frame_material_variants', 'steel_frame_material_variants_guard'),
      ('steel_frame_material_coefficients', 'steel_frame_material_coefficients_guard'),
      ('steel_frame_technical_composition_layers', 'steel_frame_technical_composition_layers_guard'),
      ('steel_frame_estimate_scenarios', 'steel_frame_estimate_scenarios_updated_at'),
      ('steel_frame_catalog_snapshots', 'steel_frame_catalog_snapshots_immutable')
  ),
  expected_storage_policies(policy_name) as (
    values
      ('steel_frame_catalog_storage_select_manage'),
      ('steel_frame_catalog_storage_insert_manage'),
      ('steel_frame_catalog_storage_delete_manage')
  ),
  checks(sort_order, area, check_name, status, severity, blocking, details) as (
    select
      10 + row_number() over (order by table_name),
      'table',
      format('public.%s', table_name),
      case when to_regclass(format('public.%I', table_name)) is not null then 'found' else 'absent' end,
      case when to_regclass(format('public.%I', table_name)) is not null then 'info' else 'blocker' end,
      to_regclass(format('public.%I', table_name)) is null,
      'Phase 2 catalog table.'
    from expected_tables

    union all select
      100 + row_number() over (order by table_name, column_name),
      'column',
      format('public.%s.%s', table_name, column_name),
      case when exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = expected_columns.table_name and column_name = expected_columns.column_name
      ) then 'found' else 'absent' end,
      case when exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = expected_columns.table_name and column_name = expected_columns.column_name
      ) then 'info' else 'blocker' end,
      not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = expected_columns.table_name and column_name = expected_columns.column_name
      ),
      'Additive Phase 2 column required by the typed catalog adapter.'
    from expected_columns

    union all select
      200 + row_number() over (order by table_name),
      'rls',
      format('public.%s', table_name),
      case when exists (
        select 1
        from pg_class relation_row
        join pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
        where namespace_row.nspname = 'public' and relation_row.relname = expected_tables.table_name and relation_row.relrowsecurity
      ) then 'enabled' else 'disabled' end,
      case when exists (
        select 1
        from pg_class relation_row
        join pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
        where namespace_row.nspname = 'public' and relation_row.relname = expected_tables.table_name and relation_row.relrowsecurity
      ) then 'info' else 'blocker' end,
      not exists (
        select 1
        from pg_class relation_row
        join pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
        where namespace_row.nspname = 'public' and relation_row.relname = expected_tables.table_name and relation_row.relrowsecurity
      ),
      'Every Phase 2 table must enforce RLS.'
    from expected_tables

    union all select
      300 + row_number() over (order by table_name, policy_name),
      'policy',
      format('public.%s.%s', table_name, policy_name),
      case when exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = expected_policies.table_name and policyname = expected_policies.policy_name
      ) then 'found' else 'absent' end,
      case when exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = expected_policies.table_name and policyname = expected_policies.policy_name
      ) then 'info' else 'blocker' end,
      not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = expected_policies.table_name and policyname = expected_policies.policy_name
      ),
      'Expected restrictive Phase 2 policy.'
    from expected_policies

    union all select
      400 + row_number() over (order by table_name, trigger_name),
      'trigger',
      format('public.%s.%s', table_name, trigger_name),
      case when exists (
        select 1
        from pg_trigger trigger_row
        join pg_class relation_row on relation_row.oid = trigger_row.tgrelid
        join pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
        where namespace_row.nspname = 'public'
          and relation_row.relname = expected_triggers.table_name
          and trigger_row.tgname = expected_triggers.trigger_name
          and not trigger_row.tgisinternal
      ) then 'found' else 'absent' end,
      case when exists (
        select 1
        from pg_trigger trigger_row
        join pg_class relation_row on relation_row.oid = trigger_row.tgrelid
        join pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
        where namespace_row.nspname = 'public'
          and relation_row.relname = expected_triggers.table_name
          and trigger_row.tgname = expected_triggers.trigger_name
          and not trigger_row.tgisinternal
      ) then 'info' else 'blocker' end,
      not exists (
        select 1
        from pg_trigger trigger_row
        join pg_class relation_row on relation_row.oid = trigger_row.tgrelid
        join pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
        where namespace_row.nspname = 'public'
          and relation_row.relname = expected_triggers.table_name
          and trigger_row.tgname = expected_triggers.trigger_name
          and not trigger_row.tgisinternal
      ),
      'Lifecycle or immutable snapshot trigger.'
    from expected_triggers

    union all select
      500,
      'function',
      'public.guard_steel_frame_catalog_snapshot_mutation()',
      case when to_regprocedure('public.guard_steel_frame_catalog_snapshot_mutation()') is not null then 'found' else 'absent' end,
      case when to_regprocedure('public.guard_steel_frame_catalog_snapshot_mutation()') is not null then 'info' else 'blocker' end,
      to_regprocedure('public.guard_steel_frame_catalog_snapshot_mutation()') is null,
      'Snapshot guard must exist.'

    union all select
      510,
      'storage',
      'steel-frame-catalog',
      case when exists (select 1 from storage.buckets where id = 'steel-frame-catalog' and public = false) then 'private' else 'missing_or_public' end,
      case when exists (select 1 from storage.buckets where id = 'steel-frame-catalog' and public = false) then 'info' else 'blocker' end,
      not exists (select 1 from storage.buckets where id = 'steel-frame-catalog' and public = false),
      'Technical references must remain in the private catalog bucket.'

    union all select
      520 + row_number() over (order by policy_name),
      'storage_policy',
      format('storage.objects.%s', policy_name),
      case when exists (
        select 1 from pg_policies
        where schemaname = 'storage' and tablename = 'objects' and policyname = expected_storage_policies.policy_name
      ) then 'found' else 'absent' end,
      case when exists (
        select 1 from pg_policies
        where schemaname = 'storage' and tablename = 'objects' and policyname = expected_storage_policies.policy_name
      ) then 'info' else 'blocker' end,
      not exists (
        select 1 from pg_policies
        where schemaname = 'storage' and tablename = 'objects' and policyname = expected_storage_policies.policy_name
      ),
      'Expected restrictive policy for the private technical catalog bucket.'
    from expected_storage_policies
  ),
  summary as (
    select bool_and(not blocking) as is_ready from checks
  )
select
  sort_order,
  area,
  check_name,
  status,
  severity,
  blocking,
  details,
  case when (select is_ready from summary) then 'PHASE2_CATALOG_READY' else 'PHASE2_CATALOG_BLOCKED' end as decision
from checks
order by sort_order;
