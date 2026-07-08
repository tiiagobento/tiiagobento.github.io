create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text default 'user',
  created_at timestamp with time zone default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  first_contact_date date default current_date,
  source text default 'Site',
  status text default 'Novo lead',
  priority text default 'Media',
  city text,
  neighborhood text,
  approximate_address text,
  project_type text,
  interest_type text,
  approximate_area numeric,
  has_land boolean default false,
  has_blueprint boolean default false,
  has_previous_quote boolean default false,
  wants_visit boolean default false,
  has_urgency boolean default false,
  desired_start_time text,
  budget_range text,
  best_contact_time text,
  assigned_to text,
  notes text,
  whatsapp_link text,
  google_business_link text,
  related_links text,
  potential_value numeric,
  closing_probability integer check (closing_probability is null or closing_probability between 0 and 100),
  lead_score integer default 0 check (lead_score between 0 and 100),
  last_contact_at timestamp with time zone,
  next_action_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  interaction_type text not null,
  responsible text,
  description text not null,
  next_step text,
  next_contact_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamp with time zone not null,
  priority text default 'Media',
  status text default 'pendente',
  responsible text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text,
  content text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Partner/Bruno briefing layer. This block is also available as an incremental
-- migration at supabase/migrations/add_partner_briefing.sql for existing installs.
alter table public.profiles
  add column if not exists role text default 'user';

alter table public.leads
  add column if not exists partner_id uuid references public.profiles(id),
  add column if not exists partner_name text,
  add column if not exists visit_scheduled_at timestamp with time zone,
  add column if not exists visit_status text default 'Aguardando agendamento',
  add column if not exists partner_notes text,
  add column if not exists partner_visit_feedback text;

create index if not exists leads_partner_visit_idx on public.leads(partner_id, visit_scheduled_at);

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'user');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'admin';
$$;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;

create policy "profiles_select_self_or_admin" on public.profiles
for select using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own_or_admin" on public.profiles
for update using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists "leads_select_own" on public.leads;
drop policy if exists "leads_insert_own" on public.leads;
drop policy if exists "leads_update_own" on public.leads;
drop policy if exists "leads_delete_own" on public.leads;
drop policy if exists "leads_select_owner_or_partner" on public.leads;
drop policy if exists "leads_insert_owner" on public.leads;
drop policy if exists "leads_update_owner" on public.leads;
drop policy if exists "leads_delete_owner" on public.leads;

create policy "leads_select_owner_or_partner" on public.leads
for select using (auth.uid() = user_id or auth.uid() = partner_id or public.is_admin());

create policy "leads_insert_owner" on public.leads
for insert with check (auth.uid() = user_id or public.is_admin());

create policy "leads_update_owner" on public.leads
for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

create policy "leads_delete_owner" on public.leads
for delete using (auth.uid() = user_id or public.is_admin());

drop policy if exists "interactions_select_own_leads" on public.interactions;
drop policy if exists "interactions_insert_own_leads" on public.interactions;
drop policy if exists "interactions_update_own_leads" on public.interactions;
drop policy if exists "interactions_delete_own_leads" on public.interactions;
drop policy if exists "interactions_select_owner_or_partner_leads" on public.interactions;
drop policy if exists "interactions_insert_owner_leads" on public.interactions;
drop policy if exists "interactions_update_owner_leads" on public.interactions;
drop policy if exists "interactions_delete_owner_leads" on public.interactions;

create policy "interactions_select_owner_or_partner_leads" on public.interactions
for select using (
  exists (
    select 1 from public.leads l
    where l.id = lead_id and (l.user_id = auth.uid() or l.partner_id = auth.uid() or public.is_admin())
  )
);

create policy "interactions_insert_owner_leads" on public.interactions
for insert with check (
  (auth.uid() = user_id or public.is_admin())
  and exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin()))
);

create policy "interactions_update_owner_leads" on public.interactions
for update using (
  (auth.uid() = user_id or public.is_admin())
  and exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin()))
)
with check (
  (auth.uid() = user_id or public.is_admin())
  and exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin()))
);

create policy "interactions_delete_owner_leads" on public.interactions
for delete using (
  (auth.uid() = user_id or public.is_admin())
  and exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin()))
);

drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;
drop policy if exists "tasks_select_owner_or_partner" on public.tasks;
drop policy if exists "tasks_insert_owner" on public.tasks;
drop policy if exists "tasks_update_owner" on public.tasks;
drop policy if exists "tasks_delete_owner" on public.tasks;

create policy "tasks_select_owner_or_partner" on public.tasks
for select using (
  auth.uid() = user_id
  or exists (select 1 from public.leads l where l.id = lead_id and l.partner_id = auth.uid())
  or public.is_admin()
);

create policy "tasks_insert_owner" on public.tasks
for insert with check (
  (auth.uid() = user_id or public.is_admin())
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin())))
);

create policy "tasks_update_owner" on public.tasks
for update using (
  (auth.uid() = user_id or public.is_admin())
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin())))
)
with check (
  (auth.uid() = user_id or public.is_admin())
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin())))
);

create policy "tasks_delete_owner" on public.tasks
for delete using (
  (auth.uid() = user_id or public.is_admin())
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = auth.uid() or public.is_admin())))
);

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
  if public.current_profile_role() <> 'partner' then
    raise exception 'Apenas parceiro pode registrar retorno por esta funcao';
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

  return updated_lead;
end;
$$;

grant execute on function public.partner_update_visit_feedback(uuid, text, text, text) to authenticated;

create or replace function public.calculate_lead_score(
  phone text,
  city text,
  neighborhood text,
  has_land boolean,
  has_blueprint boolean,
  approximate_area numeric,
  wants_visit boolean,
  status text,
  desired_start_time text,
  has_urgency boolean,
  priority text
)
returns integer
language plpgsql
immutable
as $$
declare
  score integer := 0;
  digits text := regexp_replace(coalesce(phone, ''), '\D', '', 'g');
begin
  if length(digits) >= 10 then score := score + 10; end if;
  if nullif(city, '') is not null or nullif(neighborhood, '') is not null then score := score + 10; end if;
  if coalesce(has_land, false) then score := score + 15; end if;
  if coalesce(has_blueprint, false) then score := score + 20; end if;
  if approximate_area is not null and approximate_area > 0 then score := score + 10; end if;
  if coalesce(wants_visit, false) or status in ('Visita a marcar', 'Visita marcada') then score := score + 15; end if;
  if nullif(desired_start_time, '') is not null then score := score + 10; end if;
  if coalesce(has_urgency, false) or priority = 'Alta' then score := score + 10; end if;
  return least(score, 100);
end;
$$;

create or replace function public.set_lead_business_fields()
returns trigger
language plpgsql
as $$
begin
  new.status = coalesce(nullif(new.status, ''), 'Novo lead');
  new.priority = coalesce(nullif(new.priority, ''), 'Media');
  new.lead_score = public.calculate_lead_score(
    new.phone,
    new.city,
    new.neighborhood,
    new.has_land,
    new.has_blueprint,
    new.approximate_area,
    new.wants_visit,
    new.status,
    new.desired_start_time,
    new.has_urgency,
    new.priority
  );
  return new;
end;
$$;

drop trigger if exists leads_set_business_fields on public.leads;
create trigger leads_set_business_fields before insert or update on public.leads
for each row execute function public.set_lead_business_fields();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists templates_set_updated_at on public.message_templates;
create trigger templates_set_updated_at before update on public.message_templates
for each row execute function public.set_updated_at();

create or replace function public.after_interaction_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_priority text;
begin
  select priority into lead_priority from public.leads where id = new.lead_id;

  update public.leads
  set last_contact_at = new.created_at,
      next_action_at = coalesce(new.next_contact_at, next_action_at),
      updated_at = now()
  where id = new.lead_id;

  if new.next_contact_at is not null then
    insert into public.tasks (lead_id, user_id, title, description, due_date, priority, status, responsible)
    values (
      new.lead_id,
      new.user_id,
      coalesce(nullif(new.next_step, ''), 'Proximo contato'),
      new.description,
      new.next_contact_at,
      coalesce(lead_priority, 'Media'),
      'pendente',
      new.responsible
    );
  end if;

  return new;
end;
$$;

drop trigger if exists interactions_after_insert on public.interactions;
create trigger interactions_after_insert after insert on public.interactions
for each row execute function public.after_interaction_insert();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, name, email)
select id, coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1)), email
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.interactions enable row level security;
alter table public.tasks enable row level security;
alter table public.message_templates enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own" on public.leads for select using (auth.uid() = user_id);
drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own" on public.leads for insert with check (auth.uid() = user_id);
drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own" on public.leads for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own" on public.leads for delete using (auth.uid() = user_id);

drop policy if exists "interactions_select_own_leads" on public.interactions;
create policy "interactions_select_own_leads" on public.interactions
for select using (exists (select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid()));
drop policy if exists "interactions_insert_own_leads" on public.interactions;
create policy "interactions_insert_own_leads" on public.interactions
for insert with check (auth.uid() = user_id and exists (select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid()));
drop policy if exists "interactions_update_own_leads" on public.interactions;
create policy "interactions_update_own_leads" on public.interactions
for update using (auth.uid() = user_id and exists (select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid()))
with check (auth.uid() = user_id and exists (select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid()));
drop policy if exists "interactions_delete_own_leads" on public.interactions;
create policy "interactions_delete_own_leads" on public.interactions
for delete using (auth.uid() = user_id and exists (select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid()));

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own" on public.tasks
for select using (
  auth.uid() = user_id
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid()))
);
drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
for insert with check (
  auth.uid() = user_id
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid()))
);
drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
for update using (
  auth.uid() = user_id
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid()))
)
with check (
  auth.uid() = user_id
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid()))
);
drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own" on public.tasks
for delete using (
  auth.uid() = user_id
  and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid()))
);

drop policy if exists "templates_select_own" on public.message_templates;
create policy "templates_select_own" on public.message_templates for select using (auth.uid() = user_id);
drop policy if exists "templates_insert_own" on public.message_templates;
create policy "templates_insert_own" on public.message_templates for insert with check (auth.uid() = user_id);
drop policy if exists "templates_update_own" on public.message_templates;
create policy "templates_update_own" on public.message_templates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "templates_delete_own" on public.message_templates;
create policy "templates_delete_own" on public.message_templates for delete using (auth.uid() = user_id);

create index if not exists leads_user_status_idx on public.leads(user_id, status);
create index if not exists leads_user_next_action_idx on public.leads(user_id, next_action_at);
create index if not exists interactions_lead_idx on public.interactions(lead_id);
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);

create or replace function public.seed_nova_forma_demo(target_user_id uuid default auth.uid())
returns void
language plpgsql
security invoker
as $$
declare
  owner_id uuid := coalesce(target_user_id, auth.uid());
begin
  if owner_id is null then
    raise exception 'Informe o UUID do usuario ou execute como usuario autenticado';
  end if;

  if not exists (select 1 from public.leads where user_id = owner_id) then
    insert into public.leads (
      user_id, name, phone, email, first_contact_date, source, status, priority, city, neighborhood,
      project_type, interest_type, approximate_area, has_land, has_blueprint, has_previous_quote,
      wants_visit, has_urgency, desired_start_time, budget_range, assigned_to, notes,
      potential_value, closing_probability, last_contact_at, next_action_at
    )
    values
      (owner_id, 'Solange Enfermeira', '+55 48 8461-6671', null, current_date - 1, 'Site', 'Visita a marcar', 'Alta', 'Biguacu', 'Deltaville', 'Casa em steel frame', 'Projeto residencial sem planta', null, true, false, false, true, true, '30 dias', null, 'Tiago', 'Pediu indicacao de projeto e perguntou para quando seria a visita.', 420000, 62, now() - interval '1 day', now() + interval '1 day'),
      (owner_id, 'Israel Forte', '+55 51 9265-3858', null, current_date - 4, 'WhatsApp', 'Orcamento a enviar', 'Alta', 'Florianopolis', 'Centro', 'Casa em steel frame', 'Chave na mao', 250, true, true, false, true, false, 'Antes de finalizar o projeto', null, 'Tiago', 'Mora em POA e precisa de estimativa antes de terminar o projeto.', 780000, 70, now() - interval '2 days', now()),
      (owner_id, 'Cliente Sao Jose com planta pronta', '+55 48 99901-2200', null, current_date - 8, 'Indicacao', 'Qualificado', 'Alta', 'Sao Jose', 'Kobrasol', 'Sobrado', 'Execucao completa', 190, true, true, true, true, false, '60 dias', 'R$ 600k a R$ 800k', 'Tiago', 'Ja tem planta e quer comparar steel frame com alvenaria.', 690000, 68, now() - interval '1 day', now() + interval '2 days'),
      (owner_id, 'Cliente Palhoca ampliacao', '+55 48 99888-1020', null, current_date - 11, 'Google Meu Negocio', 'Visita marcada', 'Alta', 'Palhoca', 'Pedra Branca', 'Ampliacao', 'Ampliacao residencial', 65, true, true, false, true, false, 'Julho', null, 'Tiago', 'Obra em condominio, precisa alinhar autorizacao com sindico.', 210000, 74, now() - interval '5 days', now() - interval '1 day'),
      (owner_id, 'Cliente Governador Celso Ramos', '+55 48 98823-0647', null, current_date - 1, 'Site', 'Aguardando resposta', 'Alta', 'Governador Celso Ramos', null, 'Casa em steel frame', 'Chave na mao', 180, true, false, false, false, true, 'Urgente', 'A definir', 'Tiago', 'Terreno 12x36 com APP ao lado. Precisa avaliar recuos.', 650000, 58, now() - interval '1 day', now() + interval '2 days'),
      (owner_id, 'Cliente sem resposta', '+55 51 9915-4442', null, current_date - 20, 'Site', 'Sem resposta', 'Baixa', null, null, 'Outro', null, null, false, false, false, false, false, null, null, 'Tiago', 'Lead sem retorno apos primeira abordagem.', 0, 8, now() - interval '19 days', now() - interval '4 days'),
      (owner_id, 'Cliente com visita marcada', '+55 48 98492-0550', null, current_date - 2, 'WhatsApp', 'Visita marcada', 'Alta', 'Biguacu', 'Jardim Caranda', 'Casa em steel frame', 'Visita tecnica', 140, true, false, false, true, true, 'Imediato', null, 'Tiago', 'Quer visita no terreno para validar acesso e estimativa.', 480000, 72, now(), now() + interval '3 days'),
      (owner_id, 'Cliente com orcamento enviado', '+55 48 99118-0891', null, current_date - 31, 'Instagram', 'Orcamento enviado', 'Alta', 'Biguacu', null, 'Casa em steel frame', 'Financiamento', 160, true, true, false, true, false, 'Fim do ano', null, 'Bruno', 'Perguntou sobre financiamento pela Caixa.', 510000, 64, now() - interval '6 days', now() + interval '1 day'),
      (owner_id, 'Mario Coelho', '+55 48 9115-3990', null, current_date - 1, 'Site', 'Em triagem', 'Media', 'Biguacu', 'Deltaville', 'Casa em steel frame', 'Projeto em steel frame', null, false, false, false, false, false, null, null, 'Tiago', 'Print WhatsApp: veio pelo site dizendo que gostaria de falar sobre projeto em steel frame. Informou Biguacu, Deltaville. Ainda sem dados de terreno, planta ou metragem.', null, 35, now() - interval '1 day', now() + interval '1 day'),
      (owner_id, 'Pablo', '+55 48 8813-7508', null, current_date - 12, 'WhatsApp', 'Visita a marcar', 'Media', 'Biguacu', null, 'Casa em steel frame', 'Mao de obra / montagem light steel frame', null, false, true, false, true, false, null, null, 'Tiago', 'Print WhatsApp: perguntou sobre material light steel frame para moradias, mao de obra, material com menor valor e valor para montar. Enviou imagem de exemplo e informou Biguacu. Foi sugerida visita sem compromisso.', null, 40, now() - interval '12 days', now() + interval '1 day'),
      (owner_id, 'Enzo Faure', '+34 628 11 36 31', null, current_date - 15, 'Site', 'Em triagem', 'Media', null, null, 'Obra comercial', 'Assessoria de engenharia e controle de obra', null, false, true, false, false, false, null, null, 'Tiago', 'Print WhatsApp: numero da Espanha. Conversa em espanhol; busca presupuesto para um trabalho, enviou referencia Marea e pediu assessoria em engenharia e controle de obra. Cidade/bairro ainda nao informados.', null, 30, now() - interval '15 days', now() + interval '2 days'),
      (owner_id, 'Karine', '+55 48 8835-0895', null, current_date - 16, 'WhatsApp', 'Em triagem', 'Media', 'Florianopolis', 'Rio Vermelho', 'Casa em steel frame', 'Casa com medidas, sem terreno confirmado', null, false, true, false, false, false, null, null, 'Tiago', 'Print WhatsApp: perguntou se trabalha com steel frame, enviou planta desenhada e medidas, ainda vai ver terreno. Bairro Rio Vermelho em Florianopolis. Pediu media de valores.', null, 28, now() - interval '16 days', now() + interval '3 days');
  end if;

  insert into public.leads (
    user_id, name, phone, email, first_contact_date, source, status, priority, city, neighborhood,
    project_type, interest_type, approximate_area, has_land, has_blueprint, has_previous_quote,
    wants_visit, has_urgency, desired_start_time, budget_range, assigned_to, notes,
    potential_value, closing_probability, last_contact_at, next_action_at
  )
  select
    owner_id, v.name, v.phone, null, v.first_contact_date, v.source, v.status, v.priority, v.city, v.neighborhood,
    v.project_type, v.interest_type, v.approximate_area, v.has_land, v.has_blueprint, v.has_previous_quote,
    v.wants_visit, v.has_urgency, v.desired_start_time, v.budget_range, v.assigned_to, v.notes,
    v.potential_value, v.closing_probability, v.last_contact_at, v.next_action_at
  from (
    values
      ('Mario Coelho', '+55 48 9115-3990', current_date - 1, 'Site', 'Em triagem', 'Media', 'Biguacu', 'Deltaville', 'Casa em steel frame', 'Projeto em steel frame', null::numeric, false, false, false, false, false, null::text, null::text, 'Tiago', 'Print WhatsApp: veio pelo site dizendo que gostaria de falar sobre projeto em steel frame. Informou Biguacu, Deltaville. Ainda sem dados de terreno, planta ou metragem.', null::numeric, 35, now() - interval '1 day', now() + interval '1 day'),
      ('Pablo', '+55 48 8813-7508', current_date - 12, 'WhatsApp', 'Visita a marcar', 'Media', 'Biguacu', null::text, 'Casa em steel frame', 'Mao de obra / montagem light steel frame', null::numeric, false, true, false, true, false, null::text, null::text, 'Tiago', 'Print WhatsApp: perguntou sobre material light steel frame para moradias, mao de obra, material com menor valor e valor para montar. Enviou imagem de exemplo e informou Biguacu. Foi sugerida visita sem compromisso.', null::numeric, 40, now() - interval '12 days', now() + interval '1 day'),
      ('Enzo Faure', '+34 628 11 36 31', current_date - 15, 'Site', 'Em triagem', 'Media', null::text, null::text, 'Obra comercial', 'Assessoria de engenharia e controle de obra', null::numeric, false, true, false, false, false, null::text, null::text, 'Tiago', 'Print WhatsApp: numero da Espanha. Conversa em espanhol; busca presupuesto para um trabalho, enviou referencia Marea e pediu assessoria em engenharia e controle de obra. Cidade/bairro ainda nao informados.', null::numeric, 30, now() - interval '15 days', now() + interval '2 days'),
      ('Karine', '+55 48 8835-0895', current_date - 16, 'WhatsApp', 'Em triagem', 'Media', 'Florianopolis', 'Rio Vermelho', 'Casa em steel frame', 'Casa com medidas, sem terreno confirmado', null::numeric, false, true, false, false, false, null::text, null::text, 'Tiago', 'Print WhatsApp: perguntou se trabalha com steel frame, enviou planta desenhada e medidas, ainda vai ver terreno. Bairro Rio Vermelho em Florianopolis. Pediu media de valores.', null::numeric, 28, now() - interval '16 days', now() + interval '3 days')
  ) as v(name, phone, first_contact_date, source, status, priority, city, neighborhood, project_type, interest_type, approximate_area, has_land, has_blueprint, has_previous_quote, wants_visit, has_urgency, desired_start_time, budget_range, assigned_to, notes, potential_value, closing_probability, last_contact_at, next_action_at)
  where not exists (
    select 1
    from public.leads existing
    where existing.user_id = owner_id
      and regexp_replace(existing.phone, '\D', '', 'g') = regexp_replace(v.phone, '\D', '', 'g')
  );

  if not exists (select 1 from public.message_templates where user_id = owner_id) then
    insert into public.message_templates (user_id, title, category, content)
    values
      (owner_id, 'Primeiro contato', 'Abertura', 'Ola, {nome}! Tudo bem? Aqui e da Nova Forma Steel Frame. Vi seu contato sobre construcao em steel frame e queria entender melhor sua ideia de obra. Voce ja possui terreno ou projeto/planta?'),
      (owner_id, 'Pedido de informacoes', 'Qualificacao', '{nome}, para eu te orientar melhor, me confirma cidade/bairro, metragem aproximada, se ja tem terreno e se possui planta/projeto?'),
      (owner_id, 'Cliente com planta', 'Qualificacao', 'Excelente, {nome}. Com a planta em maos conseguimos avaliar com mais precisao. Pode me enviar o PDF ou imagens do projeto para uma analise inicial?'),
      (owner_id, 'Cliente sem planta', 'Qualificacao', 'Perfeito, {nome}. Mesmo sem planta conseguimos fazer uma avaliacao inicial. Me confirma cidade/bairro, se ja tem terreno e uma ideia de metragem?'),
      (owner_id, 'Cliente querendo preco por m2', 'Educacao', '{nome}, o valor por m2 depende do projeto, padrao de acabamento, terreno e escopo. Posso entender sua metragem e cidade para te passar uma faixa mais responsavel?'),
      (owner_id, 'Agendamento de visita', 'Visita', '{nome}, o ideal e marcarmos uma visita sem compromisso para entender melhor o local. Qual dia desta semana fica melhor para voce?'),
      (owner_id, 'Confirmacao de visita', 'Visita', 'Combinado, {nome}. Confirmando nossa visita em {cidade}. Vou te chamar antes para confirmar o horario e qualquer ponto de acesso ao terreno.'),
      (owner_id, 'Follow-up pos-visita', 'Follow-up', 'Ola, {nome}. Obrigado pela visita. Vou organizar os pontos levantados e te retorno com os proximos passos para estimativa/orcamento.'),
      (owner_id, 'Follow-up de orcamento', 'Follow-up', 'Ola, {nome}. Passando para saber se conseguiu avaliar o orcamento e se ficou alguma duvida sobre o processo em steel frame.'),
      (owner_id, 'Cliente sem resposta', 'Reativacao', 'Ola, {nome}. Passando para saber se ainda faz sentido conversarmos sobre sua obra em steel frame. Posso te ajudar com alguma duvida?'),
      (owner_id, 'Lead perdido/reabertura', 'Reativacao', '{nome}, tudo bem? Se a ideia da obra voltou para o radar, posso reabrir seu atendimento e atualizar a estimativa conforme o momento atual.');
  end if;
end;
$$;
