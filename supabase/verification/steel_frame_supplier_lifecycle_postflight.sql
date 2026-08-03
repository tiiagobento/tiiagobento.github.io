-- Read-only verification after 20260805000000_steel_frame_supplier_lifecycle.sql.
select jsonb_build_object(
  'lifecycle_columns', (
    select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = 'steel_frame_suppliers'
      and column_name in ('archived_at', 'archived_by', 'archive_reason')
  ),
  'lifecycle_triggers', (
    select count(distinct trigger_name) from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'steel_frame_suppliers'
      and trigger_name in ('steel_frame_suppliers_lifecycle_guard', 'steel_frame_suppliers_catalog_audit')
  ),
  'lifecycle_functions', (
    select count(*) from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'guard_steel_frame_supplier_lifecycle',
        'create_steel_frame_supplier',
        'update_steel_frame_supplier',
        'archive_steel_frame_supplier'
      )
  ),
  'rls_enabled', coalesce((
    select table_class.relrowsecurity
    from pg_class table_class
    join pg_namespace namespace on namespace.oid = table_class.relnamespace
    where namespace.nspname = 'public'
      and table_class.relname = 'steel_frame_suppliers'
  ), false),
  'policies', (
    select count(*) from pg_policies
    where schemaname = 'public'
      and tablename = 'steel_frame_suppliers'
      and policyname in ('steel_frame_suppliers_select_authorized', 'steel_frame_suppliers_mutate_authorized')
  )
) as steel_frame_supplier_lifecycle_postflight;
