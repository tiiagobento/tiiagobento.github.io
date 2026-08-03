-- Read-only verification after 20260804000000_steel_frame_material_catalog_lifecycle.sql.
select jsonb_build_object(
  'lifecycle_columns', (
    select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = 'steel_frame_materials'
      and column_name in ('archived_at', 'archived_by', 'archive_reason')
  ),
  'archive_constraint_valid', coalesce((
    select convalidated from pg_constraint
    where conrelid = 'public.steel_frame_materials'::regclass
      and conname = 'steel_frame_materials_archive_contract_check'
  ), false),
  'audit_triggers', (
    select count(distinct trigger_name) from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table in ('steel_frame_materials', 'steel_frame_material_prices')
      and trigger_name in ('steel_frame_materials_catalog_audit', 'steel_frame_material_prices_catalog_audit')
  ),
  'lifecycle_functions', (
    select count(*) from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'update_steel_frame_material',
        'archive_steel_frame_material',
        'register_steel_frame_material_price'
      )
  ),
  'rls_enabled_tables', (
    select count(*) from pg_class table_class
    join pg_namespace namespace on namespace.oid = table_class.relnamespace
    where namespace.nspname = 'public'
      and table_class.relname in ('steel_frame_materials', 'steel_frame_material_prices')
      and table_class.relrowsecurity
  )
) as steel_frame_material_catalog_lifecycle_postflight;
