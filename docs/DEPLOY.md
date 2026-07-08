# Deploy de Producao - Nova Forma CRM

Este guia prepara a aplicacao para rodar online na Vercel com Supabase em producao.

## Checklist Rapido

- Projeto Supabase criado.
- SQL `supabase/schema.sql` aplicado no Supabase.
- Auth URLs configuradas no Supabase.
- Variaveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas na Vercel.
- Primeiro usuario criado pelo `/register`.
- Usuario principal promovido para `admin`.
- Usuario Bruno criado e promovido para `partner`, se for usar o painel do parceiro.
- Deploy da Vercel executado novamente depois de alterar variaveis.

## Variaveis de Ambiente

Configure localmente em `.env.local` e na Vercel em Project Settings > Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_PUBLIC_KEY
```

Opcionalmente, projetos Supabase novos podem mostrar uma chave publicavel com outro nome. A aplicacao tambem aceita:

```env
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
```

Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` como padrao para este deploy.

Nao configure `SUPABASE_SERVICE_ROLE_KEY` na Vercel para o fluxo atual. A aplicacao nao precisa dessa chave em producao. Se no futuro existir API server-only de administracao, use `SUPABASE_SERVICE_ROLE_KEY` apenas no backend, nunca em componente client e nunca com prefixo `NEXT_PUBLIC`.

## Supabase

### 1. Criar Projeto

1. Acesse o dashboard do Supabase.
2. Crie um novo projeto.
3. Abra Project Settings > API.
4. Copie:
   - Project URL para `NEXT_PUBLIC_SUPABASE_URL`.
   - anon public key para `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 2. Aplicar SQL

Para uma instalacao nova, aplique somente:

```text
supabase/schema.sql
```

Esse arquivo ja inclui:

- `profiles`
- `leads`
- `interactions`
- `tasks`
- `message_templates`
- campos de parceiro/Bruno em `leads`
- campos de visita
- briefing de visita
- RPC segura `partner_update_visit_feedback`
- RLS
- policies
- triggers de `updated_at`
- trigger de criacao automatica de profile
- seed `seed_nova_forma_demo`

No Supabase Dashboard:

1. Abra SQL Editor.
2. Crie uma nova query.
3. Cole o conteudo completo de `supabase/schema.sql`.
4. Execute.

Se o banco ja tinha recebido uma versao antiga sem parceiro/briefing, execute depois:

```text
supabase/migrations/add_partner_briefing.sql
```

### 3. Ordem das Migrations

Instalacao nova:

1. `supabase/schema.sql`

Banco existente antigo:

1. `supabase/schema.sql`, se ainda nao foi aplicado.
2. `supabase/migrations/add_partner_briefing.sql`, se os campos de parceiro ainda nao existirem.

### 4. Supabase Auth URLs

Depois do deploy na Vercel, configure em Authentication > URL Configuration:

Site URL:

```text
https://SEU-PROJETO.vercel.app
```

Redirect URLs:

```text
https://SEU-PROJETO.vercel.app/**
http://localhost:3000/**
```

Se tiver dominio proprio:

```text
https://SEUDOMINIO.com.br/**
https://www.SEUDOMINIO.com.br/**
```

### 5. Criar Usuario Admin

1. Rode a aplicacao.
2. Acesse `/register`.
3. Crie seu usuario principal.
4. No Supabase SQL Editor, execute:

```sql
update public.profiles
set role = 'admin', name = 'Tiago'
where email = 'SEU_EMAIL_ADMIN';
```

### 6. Configurar Bruno Como Parceiro

1. Crie o usuario do Bruno em `/register` ou em Supabase Auth.
2. Execute:

```sql
update public.profiles
set role = 'partner', name = 'Bruno'
where email = 'EMAIL_DO_BRUNO';
```

Para o Bruno ver leads no painel `/partner`, um admin precisa atribuir o lead ao perfil dele preenchendo `partner_id` e dados de visita.

### 7. Dados de Exemplo Opcional

Depois de criar seu usuario, copie o UUID dele no Supabase Auth > Users e execute:

```sql
select public.seed_nova_forma_demo('UUID_DO_USUARIO');
```

## Vercel

### 1. Subir Para GitHub

1. Crie um repositorio no GitHub.
2. Suba o projeto.
3. Confirme que `.env.local` nao foi enviado.

### 2. Importar Na Vercel

1. Acesse Vercel.
2. Clique em Add New > Project.
3. Importe o repositorio.
4. Framework Preset: Next.js.
5. Build Command: `npm run build`.
6. Install Command: `npm install`.

### 3. Variaveis Na Vercel

Em Project Settings > Environment Variables, configure:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_PUBLIC_KEY
```

Depois de criar ou alterar variaveis, rode Redeploy.

### 4. Dominio Personalizado

Se houver dominio proprio:

1. Configure o dominio em Vercel > Project > Domains.
2. Ajuste DNS conforme instrucoes da Vercel.
3. Adicione o dominio nas Redirect URLs do Supabase.

## IA com Puter.js

A importacao com IA em `/leads/ai-import` roda no client-side usando:

```text
https://js.puter.com/v2/
```

Nao precisa configurar:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- chave Puter no `.env`

O script e carregado apenas na pagina/componente da IA via `next/script`, portanto nao quebra o build server-side. No primeiro uso, o Puter pode pedir login/autorizacao em uma janela propria.

## Comandos Locais

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm run start
```

No PowerShell do Windows, se `npm` for bloqueado por execution policy, use:

```bash
npm.cmd run build
```

## Teste Online Depois Do Deploy

1. Abra `https://SEU-PROJETO.vercel.app`.
2. Acesse `/register` e crie um usuario.
3. Promova o usuario para `admin` no Supabase.
4. Faça login em `/login`.
5. Acesse `/dashboard`.
6. Crie um lead em `/leads/new`.
7. Edite o lead, mude status e prioridade.
8. Abra WhatsApp pelo botao do lead.
9. Registre uma interacao e uma tarefa.
10. Gere briefing em `/leads/[id]/briefing`.
11. Teste `/leads/ai-import` com texto e/ou print.
12. Crie o usuario Bruno, promova para `partner`, atribua um lead a ele e teste `/partner`.
13. Confirme que usuario deslogado tentando acessar `/dashboard`, `/leads` ou `/partner` e redirecionado para `/login`.
