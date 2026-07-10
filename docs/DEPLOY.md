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

AI_PROVIDER=gemini
GEMINI_API_KEY=SUA_CHAVE_SECRETA
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
https://nova-forma-crm.vercel.app
```

Redirect URLs:

```text
https://nova-forma-crm.vercel.app/**
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

Repositorio atual:

```text
https://github.com/tiiagobento/tiiagobento.github.io
```

1. Suba o projeto para esse repositorio.
2. Confirme que `.env.local` nao foi enviado.
3. Confirme que a branch principal e `main`.
4. A cada push, o GitHub Actions executa typecheck, lint, testes unitarios e build pelo workflow `.github/workflows/ci.yml`.

Apesar do nome `tiiagobento.github.io`, nao ative o GitHub Pages para esta aplicacao. O CRM usa Next.js, rotas dinamicas, SSR e Supabase Auth; a hospedagem correta e a Vercel.

### 2. Importar Na Vercel

1. Acesse Vercel.
2. Clique em Add New > Project.
3. Importe o repositorio.
4. Framework Preset: Next.js.
5. Build Command: `npm run build`.
6. Install Command: `npm install`.
7. Em Git, confirme que o repositorio esta conectado para deploy automatico da branch `main`.

Projeto atual na Vercel:

```text
Equipe: steelframe
Projeto: nova-forma-crm
Producao: https://nova-forma-crm.vercel.app
```

### 3. Variaveis Na Vercel

Em Project Settings > Environment Variables, configure:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_PUBLIC_KEY
```

Depois de criar ou alterar variaveis, rode Redeploy.

Para este projeto, cadastre as variaveis do Supabase e as variaveis do provider de IA em Production, Preview e Development. Nao cadastre `VERCEL_OIDC_TOKEN` manualmente e nao adicione `SUPABASE_SERVICE_ROLE_KEY`, pois o fluxo atual nao precisa dela.

### 4. Dominio Personalizado

Se houver dominio proprio:

1. Configure o dominio em Vercel > Project > Domains.
2. Ajuste DNS conforme instrucoes da Vercel.
3. Adicione o dominio nas Redirect URLs do Supabase.

## IA via servidor e Puter.js

A tela `/leads/ai-import` oferece dois modos:

- `IA via servidor`: chama `/api/ai/extract-leads`; a chave fica protegida no runtime da Vercel.
- `Puter no navegador`: usa `https://js.puter.com/v2/` no client-side e pode pedir autorizacao ao usuario.

A rota `/api/ai/generate-message` usa a mesma configuracao server-side para devolver uma mensagem em JSON. As duas API Routes exigem sessao Supabase valida, usam timeout e validam a resposta antes de devolve-la ao frontend.

### Variaveis de IA

Escolha um provider:

```env
AI_PROVIDER=gemini
```

Configure somente a chave correspondente:

```env
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
HUGGINGFACE_API_KEY=
```

Providers aceitos:

- `gemini`
- `groq`
- `openrouter`
- `huggingface`
- `mock`

`AI_PROVIDER=mock` nao usa chave e serve apenas para desenvolvimento/testes. Para trocar o modelo padrao sem alterar codigo, use opcionalmente `GEMINI_MODEL`, `GROQ_MODEL`, `OPENROUTER_MODEL` ou `HUGGINGFACE_MODEL`.

Nunca use `NEXT_PUBLIC_` nas chaves de IA. Depois de alterar variaveis na Vercel, execute um novo deploy.

### Como obter uma chave/free tier

Os limites gratuitos podem mudar. Confirme o plano e os limites atuais antes de usar em producao.

#### Gemini

1. Acesse [Google AI Studio - API Keys](https://aistudio.google.com/apikey).
2. Crie uma auth key para a Gemini API.
3. Configure `AI_PROVIDER=gemini` e `GEMINI_API_KEY`.
4. Consulte a [documentacao oficial de chaves](https://ai.google.dev/gemini-api/docs/api-key) e os [precos/free tier](https://ai.google.dev/gemini-api/docs/pricing).

Modelo padrao: `gemini-2.5-flash`. Use Gemini para a analise server-side de prints/imagens.

#### Groq

1. Acesse [Groq Console - API Keys](https://console.groq.com/keys).
2. Crie uma chave.
3. Configure `AI_PROVIDER=groq` e `GROQ_API_KEY`.
4. Consulte os [limites oficiais do plano gratuito](https://console.groq.com/docs/rate-limits).

Modelo padrao: `meta-llama/llama-4-scout-17b-16e-instruct`.

#### OpenRouter

1. Acesse [OpenRouter - API Keys](https://openrouter.ai/settings/keys).
2. Crie uma chave.
3. Configure `AI_PROVIDER=openrouter` e `OPENROUTER_API_KEY`.
4. O app usa `openrouter/free`; consulte o [Free Models Router](https://openrouter.ai/docs/cookbook/get-started/free-models-router-playground) e os [limites oficiais](https://openrouter.ai/docs/api/reference/limits).

#### Hugging Face

1. Acesse [Hugging Face - Access Tokens](https://huggingface.co/settings/tokens).
2. Crie um token separado para o app, com permissao de inference.
3. Configure `AI_PROVIDER=huggingface` e `HUGGINGFACE_API_KEY`.
4. Consulte [User Access Tokens](https://huggingface.co/docs/hub/en/security-tokens) e [Inference Providers](https://huggingface.co/docs/inference-providers/en/index).

Modelo padrao: `zai-org/GLM-4.5V:fastest`. A disponibilidade e os creditos dependem da conta e do provider de inferencia escolhido pelo Hugging Face.

### Puter

A importacao com IA em `/leads/ai-import` roda no client-side usando:

```text
https://js.puter.com/v2/
```

O Puter nao usa as chaves server-side. O script e carregado apenas quando o usuario seleciona o modo Puter, portanto nao quebra o build server-side. No primeiro uso, o Puter pode pedir login/autorizacao em uma janela propria.

### Analise de prints

Na tela `/leads/ai-import`, o usuario pode enviar ate 5 prints PNG/JPG/WEBP de ate 5 MB cada. O navegador converte cada arquivo em data URL, a API recebe somente `mimeType` + base64, valida a sessao Supabase e chama o provider.

- `gemini`: suporta texto + imagem via `inlineData`.
- `mock`: suporta imagem para desenvolvimento, sem IA real.
- `groq`, `openrouter` e `huggingface`: aceitam imagem somente quando o modelo configurado indicar suporte visual. Caso contrario, a API retorna: `O provider atual nao suporta analise de imagem. Use Gemini ou Puter para analisar prints.`
- `Puter`: continua como alternativa client-side para imagens quando o usuario autorizar o Puter no navegador.

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

## PWA, Offline e APK Android

O deploy da Vercel tambem e a origem usada pelo APK Capacitor:

```text
https://nova-forma-crm.vercel.app
```

Arquivos principais:

- `src/app/manifest.ts`
- `public/sw.js`
- `public/offline.html`
- `src/lib/offline/*`
- `capacitor.config.ts`

Fluxo recomendado:

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run build
npm run android:sync
npm run android:debug
```

O primeiro carregamento no APK precisa de internet. Depois, o service worker e o IndexedDB permitem abrir telas ja cacheadas, ver dados sincronizados e registrar operacoes pendentes.

Detalhes completos:

- `docs/OFFLINE_MODE.md`
- `docs/ANDROID_APK.md`
