-- Nova Forma CRM - Steel Frame Phase 2 baseline preflight
--
-- Read-only script. Run it in the Supabase SQL Editor of the CONFIRMED
-- homologation project before applying any Phase 2 migration.
--
-- It intentionally makes no schema, data, storage, policy, or permission
-- change. A `blocking` result means that Phase 2 must not be applied.

with
  baseline_tables(table_name) as (
    values
      ('profiles'),
      ('leads'),
      ('interactions'),
      ('tasks'),
      ('message_templates'),
      ('permissions'),
      ('role_permissions'),
      ('user_permission_overrides'),
      ('admin_audit_log'),
      ('partner_notifications'),
      ('partner_commissions'),
      ('lead_files'),
      ('push_device_tokens'),
      ('push_notification_deliveries'),
      ('steel_frame_estimates'),
      ('steel_frame_estimate_versions'),
      ('steel_frame_suppliers'),
      ('steel_frame_materials'),
      ('steel_frame_material_prices'),
      ('steel_frame_documents'),
      ('steel_frame_wall_segments'),
      ('steel_frame_openings'),
      ('steel_frame_reinforcement_templates'),
      ('steel_frame_technical_rules'),
      ('steel_frame_technical_compositions'),
      ('steel_frame_technical_composition_rules'),
      ('steel_frame_technical_assessments'),
      ('steel_frame_audit_logs')
  ),
  baseline_table_state as (
    select
      table_name,
      to_regclass(format('public.%I', table_name)) is not null as is_present
    from baseline_tables
  ),
  baseline_state as (
    select
      case
        when bool_and(not is_present) then 'empty_baseline_safe_for_documented_bootstrap'
        when bool_and(is_present) then 'phase2_baseline_ready'
        else 'partial_baseline_blocked'
      end as value
    from baseline_table_state
  ),
  checks(sort_order, area, check_name, status, severity, blocking, details) as (
    select
      10,
      'environment',
      'connection',
      'found',
      'info',
      false,
      format('Connected to database %s as %s.', current_database(), current_user)

    union all select
      20,
      'environment',
      'public schema',
      case when exists (select 1 from pg_namespace where nspname = 'public') then 'found' else 'absent' end,
      case when exists (select 1 from pg_namespace where nspname = 'public') then 'info' else 'blocker' end,
      not exists (select 1 from pg_namespace where nspname = 'public'),
      'The CRM tables and policies must live in the public schema.'

    union all select
      30,
      'extension',
      'pgcrypto',
      case when exists (select 1 from pg_extension where extname = 'pgcrypto') then 'found' else 'absent' end,
      case when exists (select 1 from pg_extension where extname = 'pgcrypto') then 'info' else 'blocker' end,
      not exists (select 1 from pg_extension where extname = 'pgcrypto'),
      'Required by UUID defaults in the current CRM and Steel Frame baseline.'

    union all select
      40,
      'function',
      'public.has_permission(text)',
      case when to_regprocedure('public.has_permission(text)') is not null then 'found' else 'absent' end,
      case when to_regprocedure('public.has_permission(text)') is not null then 'info' else 'blocker' end,
      to_regprocedure('public.has_permission(text)') is null,
      'Required by the current authorization policies; do not replace it with a permissive policy.'

    union all select
      50,
      'baseline',
      'bootstrap state',
      case when value = 'phase2_baseline_ready' then 'found' when value = 'empty_baseline_safe_for_documented_bootstrap' then 'warning' else 'incompatible' end,
      case when value = 'partial_baseline_blocked' then 'blocker' else 'info' end,
      value = 'partial_baseline_blocked',
      case
        when value = 'phase2_baseline_ready' then 'All required baseline tables are present.'
        when value = 'empty_baseline_safe_for_documented_bootstrap' then 'No baseline table was found. Use only the documented fresh-homologation bootstrap order.'
        else 'Some, but not all, baseline tables are present. Do not run schema.sql or Phase 2 migrations on this project.'
      end
    from baseline_state

    union all select
      100 + row_number() over (order by table_name),
      'table',
      format('public.%s', table_name),
      case when is_present then 'found' else 'absent' end,
      case when is_present then 'info' else 'blocker' end,
      not is_present,
      case
        when is_present then 'Required baseline table is available.'
        else 'Apply or repair the current baseline in a fresh homologation project before Phase 2.'
      end
    from baseline_table_state

    union all select
      200,
      'column',
      'public.profiles.active',
      case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'active') then 'found' else 'absent' end,
      case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'active') then 'info' else 'blocker' end,
      not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'active'),
      'Required by role and permission checks.'

    union all select
      210,
      'column',
      'public.leads.partner_id',
      case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'leads' and column_name = 'partner_id') then 'found' else 'absent' end,
      case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'leads' and column_name = 'partner_id') then 'info' else 'blocker' end,
      not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'leads' and column_name = 'partner_id'),
      'Required by partner access and briefing workflows.'

    union all select
      220,
      'column',
      'public.steel_frame_estimates.created_by',
      case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'steel_frame_estimates' and column_name = 'created_by') then 'found' else 'absent' end,
      case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'steel_frame_estimates' and column_name = 'created_by') then 'info' else 'blocker' end,
      not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'steel_frame_estimates' and column_name = 'created_by'),
      'Required to retain estimate ownership.'

    union all select
      230,
      'column',
      'public.steel_frame_technical_rules.status',
      case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'steel_frame_technical_rules' and column_name = 'status') then 'found' else 'absent' end,
      case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'steel_frame_technical_rules' and column_name = 'status') then 'info' else 'blocker' end,
      not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'steel_frame_technical_rules' and column_name = 'status'),
      'Required to keep draft and approved technical artifacts distinct.'

    union all select
      300,
      'foreign key',
      'steel_frame_estimate_versions.estimate_id -> steel_frame_estimates.id',
      case when exists (
        select 1
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_catalog = tc.constraint_catalog
          and kcu.constraint_schema = tc.constraint_schema
          and kcu.constraint_name = tc.constraint_name
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_catalog = tc.constraint_catalog
          and ccu.constraint_schema = tc.constraint_schema
          and ccu.constraint_name = tc.constraint_name
        where tc.table_schema = 'public'
          and tc.table_name = 'steel_frame_estimate_versions'
          and tc.constraint_type = 'FOREIGN KEY'
          and kcu.column_name = 'estimate_id'
          and ccu.table_schema = 'public'
          and ccu.table_name = 'steel_frame_estimates'
          and ccu.column_name = 'id'
      ) then 'found' else 'absent' end,
      case when exists (
        select 1
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_catalog = tc.constraint_catalog
          and kcu.constraint_schema = tc.constraint_schema
          and kcu.constraint_name = tc.constraint_name
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_catalog = tc.constraint_catalog
          and ccu.constraint_schema = tc.constraint_schema
          and ccu.constraint_name = tc.constraint_name
        where tc.table_schema = 'public'
          and tc.table_name = 'steel_frame_estimate_versions'
          and tc.constraint_type = 'FOREIGN KEY'
          and kcu.column_name = 'estimate_id'
          and ccu.table_schema = 'public'
          and ccu.table_name = 'steel_frame_estimates'
          and ccu.column_name = 'id'
      ) then 'info' else 'blocker' end,
      not exists (
        select 1
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_catalog = tc.constraint_catalog
          and kcu.constraint_schema = tc.constraint_schema
          and kcu.constraint_name = tc.constraint_name
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_catalog = tc.constraint_catalog
          and ccu.constraint_schema = tc.constraint_schema
          and ccu.constraint_name = tc.constraint_name
        where tc.table_schema = 'public'
          and tc.table_name = 'steel_frame_estimate_versions'
          and tc.constraint_type = 'FOREIGN KEY'
          and kcu.column_name = 'estimate_id'
          and ccu.table_schema = 'public'
          and ccu.table_name = 'steel_frame_estimates'
          and ccu.column_name = 'id'
      ),
      'Required for immutable estimate version history.'

    union all select
      310,
      'foreign key',
      'steel_frame_technical_assessments.estimate_id -> steel_frame_estimates.id',
      case when exists (
        select 1
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_catalog = tc.constraint_catalog
          and kcu.constraint_schema = tc.constraint_schema
          and kcu.constraint_name = tc.constraint_name
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_catalog = tc.constraint_catalog
          and ccu.constraint_schema = tc.constraint_schema
          and ccu.constraint_name = tc.constraint_name
        where tc.table_schema = 'public'
          and tc.table_name = 'steel_frame_technical_assessments'
          and tc.constraint_type = 'FOREIGN KEY'
          and kcu.column_name = 'estimate_id'
          and ccu.table_schema = 'public'
          and ccu.table_name = 'steel_frame_estimates'
          and ccu.column_name = 'id'
      ) then 'found' else 'absent' end,
      case when exists (
        select 1
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_catalog = tc.constraint_catalog
          and kcu.constraint_schema = tc.constraint_schema
          and kcu.constraint_name = tc.constraint_name
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_catalog = tc.constraint_catalog
          and ccu.constraint_schema = tc.constraint_schema
          and ccu.constraint_name = tc.constraint_name
        where tc.table_schema = 'public'
          and tc.table_name = 'steel_frame_technical_assessments'
          and tc.constraint_type = 'FOREIGN KEY'
          and kcu.column_name = 'estimate_id'
          and ccu.table_schema = 'public'
          and ccu.table_name = 'steel_frame_estimates'
          and ccu.column_name = 'id'
      ) then 'info' else 'blocker' end,
      not exists (
        select 1
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_catalog = tc.constraint_catalog
          and kcu.constraint_schema = tc.constraint_schema
          and kcu.constraint_name = tc.constraint_name
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_catalog = tc.constraint_catalog
          and ccu.constraint_schema = tc.constraint_schema
          and ccu.constraint_name = tc.constraint_name
        where tc.table_schema = 'public'
          and tc.table_name = 'steel_frame_technical_assessments'
          and tc.constraint_type = 'FOREIGN KEY'
          and kcu.column_name = 'estimate_id'
          and ccu.table_schema = 'public'
          and ccu.table_name = 'steel_frame_estimates'
          and ccu.column_name = 'id'
      ),
      'Required to tie a technical assessment to the estimate being assessed.'

    union all select
      400 + row_number() over (order by table_name),
      'rls',
      format('public.%s', table_name),
      case when exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = baseline_table_state.table_name and c.relrowsecurity
      ) then 'found' else 'absent' end,
      case when exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = baseline_table_state.table_name and c.relrowsecurity
      ) then 'info' else 'blocker' end,
      not exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = baseline_table_state.table_name and c.relrowsecurity
      ),
      'Row Level Security must be enabled before Phase 2.'
    from baseline_table_state

    union all select
      600,
      'policy',
      'leads_select_authorized',
      case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_select_authorized') then 'found' else 'absent' end,
      case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_select_authorized') then 'info' else 'blocker' end,
      not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_select_authorized'),
      'Current access-control baseline policy for lead reads.'

    union all select
      610,
      'policy',
      'steel_frame_estimates_select_authorized',
      case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'steel_frame_estimates' and policyname = 'steel_frame_estimates_select_authorized') then 'found' else 'absent' end,
      case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'steel_frame_estimates' and policyname = 'steel_frame_estimates_select_authorized') then 'info' else 'blocker' end,
      not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'steel_frame_estimates' and policyname = 'steel_frame_estimates_select_authorized'),
      'Estimate reads must remain permission-scoped.'

    union all select
      620,
      'policy',
      'steel_frame_technical_rules_select_authorized',
      case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'steel_frame_technical_rules' and policyname = 'steel_frame_technical_rules_select_authorized') then 'found' else 'absent' end,
      case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'steel_frame_technical_rules' and policyname = 'steel_frame_technical_rules_select_authorized') then 'info' else 'blocker' end,
      not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'steel_frame_technical_rules' and policyname = 'steel_frame_technical_rules_select_authorized'),
      'Technical rules must not be broadly readable or mutable.'

    union all select
      700,
      'trigger',
      'leads_set_business_fields',
      case when exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'leads' and t.tgname = 'leads_set_business_fields' and not t.tgisinternal) then 'found' else 'absent' end,
      case when exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'leads' and t.tgname = 'leads_set_business_fields' and not t.tgisinternal) then 'info' else 'blocker' end,
      not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'leads' and t.tgname = 'leads_set_business_fields' and not t.tgisinternal),
      'Keeps lead score and business fields consistent.'

    union all select
      710,
      'trigger',
      'steel_frame_estimates_updated_at',
      case when exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'steel_frame_estimates' and t.tgname = 'steel_frame_estimates_updated_at' and not t.tgisinternal) then 'found' else 'absent' end,
      case when exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'steel_frame_estimates' and t.tgname = 'steel_frame_estimates_updated_at' and not t.tgisinternal) then 'info' else 'blocker' end,
      not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'steel_frame_estimates' and t.tgname = 'steel_frame_estimates_updated_at' and not t.tgisinternal),
      'Required audit timestamp trigger for estimate changes.'

    union all select
      720,
      'trigger',
      'steel_frame_estimate_versions_guard',
      case when exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'steel_frame_estimate_versions' and t.tgname = 'steel_frame_estimate_versions_guard' and not t.tgisinternal) then 'found' else 'absent' end,
      case when exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'steel_frame_estimate_versions' and t.tgname = 'steel_frame_estimate_versions_guard' and not t.tgisinternal) then 'info' else 'blocker' end,
      not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'steel_frame_estimate_versions' and t.tgname = 'steel_frame_estimate_versions_guard' and not t.tgisinternal),
      'Protects immutable estimate versions.'

    union all select
      730,
      'trigger',
      'steel_frame_technical_rules_guard',
      case when exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'steel_frame_technical_rules' and t.tgname = 'steel_frame_technical_rules_guard' and not t.tgisinternal) then 'found' else 'absent' end,
      case when exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'steel_frame_technical_rules' and t.tgname = 'steel_frame_technical_rules_guard' and not t.tgisinternal) then 'info' else 'blocker' end,
      not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'steel_frame_technical_rules' and t.tgname = 'steel_frame_technical_rules_guard' and not t.tgisinternal),
      'Protects approved technical rule versions from silent mutation.'

    union all select
      740,
      'trigger',
      'partner_notifications_enqueue_push',
      case when exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'partner_notifications' and t.tgname = 'partner_notifications_enqueue_push' and not t.tgisinternal) then 'found' else 'absent' end,
      case when exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'partner_notifications' and t.tgname = 'partner_notifications_enqueue_push' and not t.tgisinternal) then 'info' else 'blocker' end,
      not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'partner_notifications' and t.tgname = 'partner_notifications_enqueue_push' and not t.tgisinternal),
      'Queues partner activity for the current push delivery workflow.'

    union all select
      800,
      'index',
      'steel_frame_estimates_lead_idx',
      case when to_regclass('public.steel_frame_estimates_lead_idx') is not null then 'found' else 'absent' end,
      case when to_regclass('public.steel_frame_estimates_lead_idx') is not null then 'info' else 'warning' end,
      false,
      'Expected estimate lookup index.'

    union all select
      810,
      'index',
      'steel_frame_estimate_versions_estimate_idx',
      case when to_regclass('public.steel_frame_estimate_versions_estimate_idx') is not null then 'found' else 'absent' end,
      case when to_regclass('public.steel_frame_estimate_versions_estimate_idx') is not null then 'info' else 'warning' end,
      false,
      'Expected estimate version lookup index.'

    union all select
      820,
      'index',
      'steel_frame_technical_rules_status_idx',
      case when to_regclass('public.steel_frame_technical_rules_status_idx') is not null then 'found' else 'absent' end,
      case when to_regclass('public.steel_frame_technical_rules_status_idx') is not null then 'info' else 'warning' end,
      false,
      'Expected technical rule status and validity index.'

    union all select
      900,
      'storage',
      'steel-frame-documents private bucket',
      case
        when exists (select 1 from storage.buckets where id = 'steel-frame-documents' and public = false) then 'found'
        when exists (select 1 from storage.buckets where id = 'steel-frame-documents') then 'incompatible'
        else 'absent'
      end,
      case
        when exists (select 1 from storage.buckets where id = 'steel-frame-documents' and public = false) then 'info'
        else 'blocker'
      end,
      not exists (select 1 from storage.buckets where id = 'steel-frame-documents' and public = false),
      'Current estimate files require a private bucket.'

    union all select
      910,
      'storage',
      'lead-files private bucket',
      case
        when exists (select 1 from storage.buckets where id = 'lead-files' and public = false) then 'found'
        when exists (select 1 from storage.buckets where id = 'lead-files') then 'incompatible'
        else 'absent'
      end,
      case
        when exists (select 1 from storage.buckets where id = 'lead-files' and public = false) then 'info'
        else 'blocker'
      end,
      not exists (select 1 from storage.buckets where id = 'lead-files' and public = false),
      'Current lead attachments require a private bucket.'

    union all select
      920,
      'storage',
      'steel-frame-catalog private bucket',
      case
        when exists (select 1 from storage.buckets where id = 'steel-frame-catalog' and public = false) then 'found'
        when exists (select 1 from storage.buckets where id = 'steel-frame-catalog') then 'incompatible'
        else 'absent'
      end,
      case
        when exists (select 1 from storage.buckets where id = 'steel-frame-catalog') and not exists (select 1 from storage.buckets where id = 'steel-frame-catalog' and public = false) then 'blocker'
        else 'warning'
      end,
      exists (select 1 from storage.buckets where id = 'steel-frame-catalog') and not exists (select 1 from storage.buckets where id = 'steel-frame-catalog' and public = false),
      'Expected to be absent before Phase 2. Create it only in confirmed homologation after the baseline is ready.'
  ),
  decision as (
    select
      case when bool_or(blocking) then 'BLOCKED' else 'READY_FOR_PHASE2_HOMOLOGATION' end as result,
      count(*) filter (where blocking) as blocking_count,
      count(*) filter (where severity = 'warning') as warning_count
    from checks
  )
select
  sort_order,
  area,
  check_name,
  status,
  severity,
  blocking,
  details
from checks
union all
select
  9999,
  'decision',
  'Phase 2 migration gate',
  lower(result),
  case when result = 'BLOCKED' then 'blocker' else 'info' end,
  result = 'BLOCKED',
  format('%s. %s blocking check(s), %s warning(s).', result, blocking_count, warning_count)
from decision
order by sort_order;
