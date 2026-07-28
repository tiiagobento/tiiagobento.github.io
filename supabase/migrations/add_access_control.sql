-- Access control for administrators, standard users, partners and custom roles.
-- This migration is additive/idempotent: it never deletes CRM records.

alter table public.profiles
  add column if not exists active boolean;

alter table public.profiles
  add column if not exists updated_at timestamp with time zone;

update public.profiles set active = true where active is null;
update public.profiles set updated_at = coalesce(updated_at, created_at, now()) where updated_at is null;

alter table public.profiles
  alter column active set default true,
  alter column active set not null,
  alter column role set default 'user',
  alter column updated_at set default now(),
  alter column updated_at set not null;

update public.profiles set role = 'user' where role is null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'user', 'partner', 'custom')) not valid;

create table if not exists public.permissions (
  key text primary key,
  label text not null,
  category text not null,
  description text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.role_permissions (
  role text not null check (role in ('admin', 'user', 'partner', 'custom')),
  permission_key text not null references public.permissions(key) on delete cascade,
  allowed boolean not null default true,
  created_at timestamp with time zone not null default now(),
  primary key (role, permission_key)
);

create table if not exists public.user_permission_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  allowed boolean not null,
  expires_at timestamp with time zone,
  granted_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (user_id, permission_key)
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  subject_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamp with time zone not null default now()
);

create index if not exists user_permission_overrides_user_idx on public.user_permission_overrides(user_id);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_subject_idx on public.admin_audit_log(subject_user_id, created_at desc);

insert into public.permissions (key, label, category, description) values
  ('leads.view_own', 'Ver proprios leads', 'Leads', 'Acessa somente leads de sua propriedade.'),
  ('leads.view_assigned', 'Ver leads atribuidos', 'Leads', 'Acessa leads atribuidos como parceiro.'),
  ('leads.view_all', 'Ver todos os leads', 'Leads', 'Acessa toda a carteira comercial.'),
  ('leads.create', 'Criar leads', 'Leads', 'Permite cadastrar leads.'),
  ('leads.update', 'Editar proprios leads', 'Leads', 'Permite editar leads de sua propriedade.'),
  ('leads.update_all', 'Editar todos os leads', 'Leads', 'Permite editar qualquer lead autorizado.'),
  ('leads.delete', 'Excluir proprios leads', 'Leads', 'Permite excluir leads de sua propriedade.'),
  ('leads.delete_all', 'Excluir todos os leads', 'Leads', 'Permite excluir qualquer lead autorizado.'),
  ('partners.assign', 'Atribuir parceiro', 'Visitas', 'Permite atribuir ou remover parceiros de leads.'),
  ('briefings.view_assigned', 'Ver briefing atribuido', 'Visitas', 'Permite abrir briefing de visita atribuida.'),
  ('briefings.manage', 'Gerenciar briefings', 'Visitas', 'Permite criar ou alterar briefing e agenda.'),
  ('visits.submit_feedback', 'Registrar retorno de visita', 'Visitas', 'Permite registrar retorno no lead atribuido.'),
  ('tasks.view_own', 'Ver proprias tarefas', 'Tarefas', 'Acessa tarefas do proprio usuario.'),
  ('tasks.view_assigned', 'Ver tarefas atribuidas', 'Tarefas', 'Acessa tarefas de leads atribuidos.'),
  ('tasks.view_all', 'Ver todas as tarefas', 'Tarefas', 'Acessa todas as tarefas.'),
  ('tasks.create', 'Criar tarefas', 'Tarefas', 'Permite criar tarefas.'),
  ('tasks.update', 'Editar proprias tarefas', 'Tarefas', 'Permite editar tarefas proprias.'),
  ('tasks.delete', 'Excluir proprias tarefas', 'Tarefas', 'Permite excluir tarefas proprias.'),
  ('interactions.view_own', 'Ver interacoes proprias', 'Interacoes', 'Acessa interacoes de leads proprios.'),
  ('interactions.create', 'Registrar interacoes', 'Interacoes', 'Permite registrar interacoes.'),
  ('interactions.update', 'Editar interacoes proprias', 'Interacoes', 'Permite editar interacoes proprias.'),
  ('interactions.delete', 'Excluir interacoes proprias', 'Interacoes', 'Permite excluir interacoes proprias.'),
  ('templates.view_own', 'Ver proprios templates', 'Templates', 'Acessa templates proprios.'),
  ('templates.view_all', 'Ver todos os templates', 'Templates', 'Acessa todos os templates.'),
  ('templates.manage', 'Gerenciar templates', 'Templates', 'Permite criar, editar e excluir templates.'),
  ('whatsapp.open', 'Abrir WhatsApp', 'Templates', 'Permite preparar e abrir conversas no WhatsApp.'),
  ('ai.generate', 'Gerar mensagens com IA', 'IA', 'Permite preparar respostas comerciais com IA.'),
  ('ai.import', 'Importar leads com IA', 'IA', 'Permite extrair rascunhos de leads a partir de texto e imagens.'),
  ('ai.daily_plan', 'Gerar plano diario com IA', 'IA', 'Permite usar o assistente de prioridades comerciais.'),
  ('notifications.view_all', 'Ver todas as notificacoes', 'Visitas', 'Acessa notificacoes de parceiros.'),
  ('users.view', 'Ver usuarios', 'Administracao', 'Acessa a central de usuarios.'),
  ('users.manage', 'Gerenciar usuarios', 'Administracao', 'Altera papeis e acessos de usuarios.'),
  ('permissions.manage', 'Gerenciar permissoes', 'Administracao', 'Concede e revoga permissoes.'),
  ('audit.view', 'Ver auditoria', 'Administracao', 'Acessa o historico administrativo.'),
  ('data.import', 'Importar dados', 'Administracao', 'Permite importar dados.'),
  ('data.export', 'Exportar dados', 'Administracao', 'Permite exportar dados.')
on conflict (key) do update set
  label = excluded.label,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (role, permission_key, allowed)
select 'user', permission_key, true
from (values
  ('leads.view_own'), ('leads.create'), ('leads.update'), ('leads.delete'),
  ('tasks.view_own'), ('tasks.create'), ('tasks.update'), ('tasks.delete'),
  ('interactions.view_own'), ('interactions.create'), ('interactions.update'), ('interactions.delete'),
  ('templates.view_own'), ('templates.manage'), ('whatsapp.open'),
  ('ai.generate'), ('ai.import'), ('ai.daily_plan')
) as defaults(permission_key)
on conflict (role, permission_key) do update set allowed = excluded.allowed;

insert into public.role_permissions (role, permission_key, allowed)
select 'partner', permission_key, true
from (values
  ('leads.view_assigned'), ('briefings.view_assigned'), ('visits.submit_feedback'),
  ('tasks.view_assigned')
) as defaults(permission_key)
on conflict (role, permission_key) do update set allowed = excluded.allowed;

delete from public.role_permissions
where role = 'partner' and permission_key = 'notifications.view_all';

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'user');
$$;

create or replace function public.current_profile_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_is_active() and public.current_profile_role() = 'admin';
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

  profile_role := public.current_profile_role();
  if profile_role = 'admin' then
    return true;
  end if;

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

create or replace function public.prevent_profile_access_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id
    and not public.has_permission('users.manage')
    and (new.role is distinct from old.role or new.active is distinct from old.active) then
    raise exception 'Nao e permitido alterar o proprio papel ou estado de acesso';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_access_escalation on public.profiles;
create trigger profiles_prevent_access_escalation
before update on public.profiles
for each row execute function public.prevent_profile_access_escalation();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.write_admin_audit(
  action_name text,
  target_user_id uuid,
  before_values jsonb default null,
  after_values jsonb default null,
  action_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_audit_log (actor_id, subject_user_id, action, old_values, new_values, reason)
  values (auth.uid(), target_user_id, action_name, before_values, after_values, nullif(action_reason, ''));
end;
$$;

drop function if exists public.admin_update_user_access(uuid, text, boolean, jsonb, text);
create function public.admin_update_user_access(
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

  perform public.write_admin_audit(
    'user.access_updated',
    target_user_id,
    jsonb_build_object('name', previous_profile.name, 'role', previous_profile.role, 'active', previous_profile.active),
    jsonb_build_object('name', updated_profile.name, 'role', updated_profile.role, 'active', updated_profile.active),
    action_reason
  );

  return updated_profile;
end;
$$;

create or replace function public.guard_and_audit_partner_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partner_id is distinct from old.partner_id then
    if not public.has_permission('partners.assign') then
      raise exception 'Permissao insuficiente para atribuir parceiro';
    end if;

    perform public.write_admin_audit(
      'lead.partner_assigned',
      new.partner_id,
      jsonb_build_object('lead_id', old.id, 'partner_id', old.partner_id),
      jsonb_build_object('lead_id', new.id, 'partner_id', new.partner_id),
      null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists leads_guard_partner_assignment on public.leads;
create trigger leads_guard_partner_assignment
before update on public.leads
for each row execute function public.guard_and_audit_partner_assignment();

create or replace function public.partner_update_visit_feedback(
  target_lead_id uuid,
  new_visit_status text,
  new_partner_notes text,
  new_partner_visit_feedback text
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_lead public.leads;
begin
  if not public.has_permission('visits.submit_feedback') then
    raise exception 'Permissao insuficiente para registrar retorno de visita';
  end if;

  update public.leads
  set
    visit_status = coalesce(nullif(new_visit_status, ''), visit_status),
    partner_notes = new_partner_notes,
    partner_visit_feedback = new_partner_visit_feedback,
    updated_at = now()
  where id = target_lead_id
    and partner_id = auth.uid()
  returning * into updated_lead;

  if updated_lead.id is null then
    raise exception 'Lead nao encontrado ou nao atribuido ao parceiro logado';
  end if;

  perform public.write_admin_audit(
    'partner.visit_feedback_submitted',
    auth.uid(),
    null,
    jsonb_build_object('lead_id', updated_lead.id, 'visit_status', updated_lead.visit_status),
    null
  );
  return updated_lead;
end;
$$;

create or replace function public.notify_partner_visit_briefing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_type text;
  notification_title text;
  notification_body text;
begin
  if new.partner_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' or new.partner_id is distinct from old.partner_id then
    notification_type := 'visit_briefing_assigned';
    notification_title := 'Novo briefing de visita';
  elsif new.visit_scheduled_at is distinct from old.visit_scheduled_at then
    notification_type := case when old.visit_scheduled_at is null then 'visit_assigned' else 'visit_rescheduled' end;
    notification_title := case when old.visit_scheduled_at is null then 'Visita agendada' else 'Visita reagendada' end;
  else
    notification_type := 'visit_briefing_updated';
    notification_title := 'Briefing de visita atualizado';
  end if;

  notification_body := concat(
    'Lead ', new.name,
    case when new.visit_scheduled_at is null then '. Data da visita a confirmar.'
      else concat('. Visita: ', to_char(new.visit_scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), '.') end
  );

  insert into public.partner_notifications (user_id, lead_id, type, title, body)
  values (new.partner_id, new.id, notification_type, notification_title, notification_body);
  return new;
end;
$$;

alter table public.partner_notifications drop constraint if exists partner_notifications_type_check;
alter table public.partner_notifications add constraint partner_notifications_type_check
check (type in ('visit_briefing_assigned', 'visit_briefing_updated', 'visit_assigned', 'visit_rescheduled', 'visit_status_updated', 'feedback_requested', 'deadline_approaching')) not valid;

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_self_or_authorized" on public.profiles;
drop policy if exists "profiles_update_self_safe" on public.profiles;
create policy "profiles_select_self_or_authorized" on public.profiles
for select using (auth.uid() = id or public.has_permission('users.view'));
create policy "profiles_update_self_safe" on public.profiles
for update using (auth.uid() = id and public.current_profile_is_active())
with check (
  auth.uid() = id
  and role = public.current_profile_role()
  and active = public.current_profile_is_active()
);

drop policy if exists "leads_select_own" on public.leads;
drop policy if exists "leads_insert_own" on public.leads;
drop policy if exists "leads_update_own" on public.leads;
drop policy if exists "leads_delete_own" on public.leads;
drop policy if exists "leads_select_owner_or_partner" on public.leads;
drop policy if exists "leads_insert_owner" on public.leads;
drop policy if exists "leads_update_owner" on public.leads;
drop policy if exists "leads_delete_owner" on public.leads;
drop policy if exists "leads_select_authorized" on public.leads;
drop policy if exists "leads_insert_authorized" on public.leads;
drop policy if exists "leads_update_authorized" on public.leads;
drop policy if exists "leads_delete_authorized" on public.leads;
create policy "leads_select_authorized" on public.leads for select using (
  (auth.uid() = user_id and public.has_permission('leads.view_own'))
  or (auth.uid() = partner_id and public.has_permission('leads.view_assigned'))
  or public.has_permission('leads.view_all')
);
create policy "leads_insert_authorized" on public.leads for insert with check (
  public.current_profile_is_active()
  and ((auth.uid() = user_id and public.has_permission('leads.create')) or public.has_permission('leads.update_all'))
);
create policy "leads_update_authorized" on public.leads for update using (
  (auth.uid() = user_id and public.has_permission('leads.update')) or public.has_permission('leads.update_all')
) with check (
  (auth.uid() = user_id and public.has_permission('leads.update')) or public.has_permission('leads.update_all')
);
create policy "leads_delete_authorized" on public.leads for delete using (
  (auth.uid() = user_id and public.has_permission('leads.delete')) or public.has_permission('leads.delete_all')
);

drop policy if exists "interactions_select_own_leads" on public.interactions;
drop policy if exists "interactions_insert_own_leads" on public.interactions;
drop policy if exists "interactions_update_own_leads" on public.interactions;
drop policy if exists "interactions_delete_own_leads" on public.interactions;
drop policy if exists "interactions_select_owner_or_partner_leads" on public.interactions;
drop policy if exists "interactions_insert_owner_leads" on public.interactions;
drop policy if exists "interactions_update_owner_leads" on public.interactions;
drop policy if exists "interactions_delete_owner_leads" on public.interactions;
drop policy if exists "interactions_select_authorized" on public.interactions;
drop policy if exists "interactions_insert_authorized" on public.interactions;
drop policy if exists "interactions_update_authorized" on public.interactions;
drop policy if exists "interactions_delete_authorized" on public.interactions;
create policy "interactions_select_authorized" on public.interactions for select using (
  exists (select 1 from public.leads l where l.id = lead_id)
);
create policy "interactions_insert_authorized" on public.interactions for insert with check (
  public.current_profile_is_active()
  and auth.uid() = user_id
  and public.has_permission('interactions.create')
  and exists (select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid())
);
create policy "interactions_update_authorized" on public.interactions for update using (
  auth.uid() = user_id and public.has_permission('interactions.update')
) with check (
  auth.uid() = user_id and public.has_permission('interactions.update')
);
create policy "interactions_delete_authorized" on public.interactions for delete using (
  auth.uid() = user_id and public.has_permission('interactions.delete')
);

drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;
drop policy if exists "tasks_select_owner_or_partner" on public.tasks;
drop policy if exists "tasks_insert_owner" on public.tasks;
drop policy if exists "tasks_update_owner" on public.tasks;
drop policy if exists "tasks_delete_owner" on public.tasks;
drop policy if exists "tasks_select_authorized" on public.tasks;
drop policy if exists "tasks_insert_authorized" on public.tasks;
drop policy if exists "tasks_update_authorized" on public.tasks;
drop policy if exists "tasks_delete_authorized" on public.tasks;
create policy "tasks_select_authorized" on public.tasks for select using (
  (auth.uid() = user_id and public.has_permission('tasks.view_own'))
  or (exists (select 1 from public.leads l where l.id = lead_id and l.partner_id = auth.uid()) and public.has_permission('tasks.view_assigned'))
  or public.has_permission('tasks.view_all')
);
create policy "tasks_insert_authorized" on public.tasks for insert with check (
  auth.uid() = user_id and public.has_permission('tasks.create')
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid()))
);
create policy "tasks_update_authorized" on public.tasks for update using (
  auth.uid() = user_id and public.has_permission('tasks.update')
) with check (
  auth.uid() = user_id and public.has_permission('tasks.update')
);
create policy "tasks_delete_authorized" on public.tasks for delete using (
  auth.uid() = user_id and public.has_permission('tasks.delete')
);

drop policy if exists "templates_select_own" on public.message_templates;
drop policy if exists "templates_insert_own" on public.message_templates;
drop policy if exists "templates_update_own" on public.message_templates;
drop policy if exists "templates_delete_own" on public.message_templates;
drop policy if exists "templates_select_authorized" on public.message_templates;
drop policy if exists "templates_insert_authorized" on public.message_templates;
drop policy if exists "templates_update_authorized" on public.message_templates;
drop policy if exists "templates_delete_authorized" on public.message_templates;
create policy "templates_select_authorized" on public.message_templates for select using (
  (auth.uid() = user_id and public.has_permission('templates.view_own')) or public.has_permission('templates.view_all')
);
create policy "templates_insert_authorized" on public.message_templates for insert with check (
  auth.uid() = user_id and public.has_permission('templates.manage')
);
create policy "templates_update_authorized" on public.message_templates for update using (
  auth.uid() = user_id and public.has_permission('templates.manage')
) with check (
  auth.uid() = user_id and public.has_permission('templates.manage')
);
create policy "templates_delete_authorized" on public.message_templates for delete using (
  auth.uid() = user_id and public.has_permission('templates.manage')
);

drop policy if exists "partner_notifications_select_recipient_or_admin" on public.partner_notifications;
drop policy if exists "partner_notifications_update_recipient_or_admin" on public.partner_notifications;
drop policy if exists "partner_notifications_select_authorized" on public.partner_notifications;
drop policy if exists "partner_notifications_update_recipient" on public.partner_notifications;
create policy "partner_notifications_select_authorized" on public.partner_notifications
for select using (
  public.current_profile_is_active()
  and (auth.uid() = user_id or public.has_permission('notifications.view_all'))
);
create policy "partner_notifications_update_recipient" on public.partner_notifications
for update using (public.current_profile_is_active() and auth.uid() = user_id)
with check (public.current_profile_is_active() and auth.uid() = user_id);

drop policy if exists "permissions_select_authenticated" on public.permissions;
drop policy if exists "role_permissions_select_authenticated" on public.role_permissions;
drop policy if exists "user_permission_overrides_select_self_or_manager" on public.user_permission_overrides;
drop policy if exists "admin_audit_log_select_authorized" on public.admin_audit_log;
create policy "permissions_select_authenticated" on public.permissions for select using (public.current_profile_is_active());
create policy "role_permissions_select_authenticated" on public.role_permissions for select using (public.current_profile_is_active());
create policy "user_permission_overrides_select_self_or_manager" on public.user_permission_overrides
for select using (auth.uid() = user_id or public.has_permission('permissions.manage'));
create policy "admin_audit_log_select_authorized" on public.admin_audit_log
for select using (public.has_permission('audit.view'));

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.permissions, public.role_permissions, public.user_permission_overrides, public.admin_audit_log to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_profile_is_active() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.admin_update_user_access(uuid, text, boolean, text, jsonb, text) to authenticated;
grant execute on function public.partner_update_visit_feedback(uuid, text, text, text) to authenticated;
