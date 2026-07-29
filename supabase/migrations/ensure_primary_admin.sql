-- Primary admin bootstrap for Nova Forma CRM.
-- Idempotent and additive: it does not delete CRM data.

create or replace function public.primary_admin_email()
returns text
language sql
immutable
as $$
  select 'tiagov.bento@gmail.com'::text;
$$;

create or replace function public.is_primary_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = public.primary_admin_email();
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_primary_admin() then 'admin'
    else coalesce((select role from public.profiles where id = auth.uid()), 'user')
  end;
$$;

create or replace function public.current_profile_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_primary_admin() then true
    else coalesce((select active from public.profiles where id = auth.uid()), false)
  end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_primary_admin()
    or (public.current_profile_is_active() and public.current_profile_role() = 'admin');
$$;

create or replace function public.has_permission(permission_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile_role text;
  override_allowed boolean;
  role_allowed boolean;
begin
  if auth.uid() is null or not public.current_profile_is_active() then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  profile_role := public.current_profile_role();

  select allowed into override_allowed
  from public.user_permission_overrides
  where user_id = auth.uid()
    and permission_key = permission_name
    and (expires_at is null or expires_at > now())
  limit 1;

  if found then
    return override_allowed;
  end if;

  select allowed into role_allowed
  from public.role_permissions
  where role = profile_role and permission_key = permission_name
  limit 1;

  return coalesce(role_allowed, false);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.email,
    case when lower(coalesce(new.email, '')) = public.primary_admin_email() then 'admin' else 'user' end,
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(public.profiles.name, excluded.name),
    role = case when lower(coalesce(excluded.email, '')) = public.primary_admin_email() then 'admin' else public.profiles.role end,
    active = case when lower(coalesce(excluded.email, '')) = public.primary_admin_email() then true else public.profiles.active end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, name, email, role, active)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'name', u.email, 'Tiago'),
  u.email,
  'admin',
  true
from auth.users u
where lower(coalesce(u.email, '')) = public.primary_admin_email()
on conflict (id) do update set
  email = excluded.email,
  name = coalesce(public.profiles.name, excluded.name),
  role = 'admin',
  active = true,
  updated_at = now();

do $$
declare
  target_id uuid;
begin
  select id into target_id from public.profiles where lower(coalesce(email, '')) = public.primary_admin_email() limit 1;
  if target_id is not null and to_regclass('public.admin_audit_log') is not null then
    insert into public.admin_audit_log (actor_id, subject_user_id, action, old_values, new_values, reason)
    values (
      target_id,
      target_id,
      'primary_admin.bootstrap',
      null,
      jsonb_build_object('email', public.primary_admin_email(), 'role', 'admin', 'active', true),
      'Garantir conta principal administrativa para configuracao de parceiros.'
    );
  end if;
end $$;

grant execute on function public.primary_admin_email() to authenticated;
grant execute on function public.is_primary_admin() to authenticated;
