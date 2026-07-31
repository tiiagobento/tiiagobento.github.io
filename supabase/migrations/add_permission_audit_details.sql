-- Keeps the existing access-control model intact while recording the effective
-- individual permission set on every administrative access update.
-- This migration is additive and does not remove profiles, overrides, or audit data.

create or replace function public.admin_update_user_access(
  target_user_id uuid,
  requested_role text,
  requested_active boolean,
  requested_name text default null,
  requested_overrides jsonb default '[]'::jsonb,
  action_reason text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_profile public.profiles;
  updated_profile public.profiles;
  override_item jsonb;
  active_admins integer;
  previous_overrides jsonb;
  applied_overrides jsonb;
begin
  if not public.has_permission('users.manage') then
    raise exception 'Permissao insuficiente para administrar usuarios';
  end if;

  if requested_role not in ('admin', 'user', 'partner', 'custom') then
    raise exception 'Papel invalido';
  end if;

  select * into previous_profile from public.profiles where id = target_user_id for update;
  if previous_profile.id is null then
    raise exception 'Usuario nao encontrado';
  end if;

  if previous_profile.role = 'admin' and previous_profile.active
    and (requested_role <> 'admin' or not requested_active) then
    select count(*) into active_admins from public.profiles where role = 'admin' and active;
    if active_admins <= 1 then
      raise exception 'O ultimo administrador ativo nao pode ser removido ou desativado';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'permission_key', permission_key,
    'allowed', allowed,
    'expires_at', expires_at,
    'reason', reason
  ) order by permission_key), '[]'::jsonb)
  into previous_overrides
  from public.user_permission_overrides
  where user_id = target_user_id;

  update public.profiles
  set
    name = coalesce(nullif(trim(requested_name), ''), name),
    role = requested_role,
    active = requested_active
  where id = target_user_id
  returning * into updated_profile;

  if jsonb_typeof(coalesce(requested_overrides, '[]'::jsonb)) <> 'array' then
    raise exception 'Permissoes devem ser uma lista';
  end if;

  for override_item in select value from jsonb_array_elements(coalesce(requested_overrides, '[]'::jsonb)) loop
    if not exists (select 1 from public.permissions where key = override_item->>'permission_key') then
      raise exception 'Permissao desconhecida: %', coalesce(override_item->>'permission_key', '');
    end if;
    if jsonb_typeof(override_item->'allowed') <> 'boolean' then
      raise exception 'A permissao precisa informar allowed como booleano';
    end if;

    insert into public.user_permission_overrides (user_id, permission_key, allowed, expires_at, granted_by, reason)
    values (
      target_user_id,
      override_item->>'permission_key',
      (override_item->>'allowed')::boolean,
      nullif(override_item->>'expires_at', '')::timestamp with time zone,
      auth.uid(),
      nullif(override_item->>'reason', '')
    )
    on conflict (user_id, permission_key) do update set
      allowed = excluded.allowed,
      expires_at = excluded.expires_at,
      granted_by = excluded.granted_by,
      reason = excluded.reason,
      updated_at = now();
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'permission_key', permission_key,
    'allowed', allowed,
    'expires_at', expires_at,
    'reason', reason
  ) order by permission_key), '[]'::jsonb)
  into applied_overrides
  from public.user_permission_overrides
  where user_id = target_user_id;

  perform public.write_admin_audit(
    'user.access_updated',
    target_user_id,
    jsonb_build_object(
      'name', previous_profile.name,
      'role', previous_profile.role,
      'active', previous_profile.active,
      'permission_overrides', previous_overrides
    ),
    jsonb_build_object(
      'name', updated_profile.name,
      'role', updated_profile.role,
      'active', updated_profile.active,
      'permission_overrides', applied_overrides
    ),
    action_reason
  );

  return updated_profile;
end;
$$;

grant execute on function public.admin_update_user_access(uuid, text, boolean, text, jsonb, text) to authenticated;
