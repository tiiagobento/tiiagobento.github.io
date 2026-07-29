# Deploy de Producao - Nova Forma CRM

Este guia prepara a aplicacao para rodar online na Vercel com Supabase em producao.

## Checklist Rapido

- Projeto Supabase criado.
- SQL `supabase/schema.sql` aplicado no Supabase.
- Auth URLs configuradas no Supabase.
- Variaveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas na Vercel.
- Primeiro usuario criado pelo `/register`.
- Usuario principal promovido para `admin`.
- Usuarios Bruno e Rafael criados e promovidos para `partner`, se forem usar o painel do parceiro.
- Deploy da Vercel executado novamente depois de alterar variaveis.

## Variaveis de Ambiente

Configure localmente em `.env.local` e na Vercel em Project Settings > Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_PUBLIC_KEY

AI_PROVIDER=gemini
GEMINI_API_KEY=SUA_CHAVE_SECRETA
AI_REQUEST_TIMEOUT_MS=30000
```

Opcionalmente, projetos Supabase novos podem mostrar uma chave publicavel com outro nome. A aplicacao tambem aceita:

```env
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
```

Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` como padrao para este deploy.

`SUPABASE_SERVICE_ROLE_KEY` e opcional para login, CRM, parceiros e RLS. Configure-a apenas no ambiente de backend da Vercel se quiser usar convite por e-mail na central **Usuarios e acessos** ou notificacoes push Android. Ela nunca pode ter prefixo `NEXT_PUBLIC` e nunca pode ser exibida na interface.

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

Esse arquivo inclui a base do CRM. Depois aplique as migrations incrementais listadas abaixo para deixar a base na versao atual de parceiros, notificacoes e controle de acesso.

- `profiles`
- `leads`
- `interactions`
- `tasks`
- `message_templates`
- campos de parceiro/Bruno em `leads`
- campos de visita
- briefing de visita
- RPC segura `partner_update_visit_feedback`
- notificacoes internas de briefing para parceiros
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

Se o banco ja tinha recebido uma versao antiga, execute as migrations incrementais aplicaveis depois:

```text
supabase/migrations/add_partner_briefing.sql
supabase/migrations/add_partner_notifications.sql
supabase/migrations/add_access_control.sql
supabase/migrations/add_push_notifications.sql
```

### 3. Ordem das Migrations

Instalacao nova:

1. `supabase/schema.sql`
2. `supabase/migrations/add_partner_briefing.sql`
3. `supabase/migrations/add_partner_notifications.sql`
4. `supabase/migrations/add_access_control.sql`
5. `supabase/migrations/add_push_notifications.sql`

Banco existente antigo:

1. `supabase/schema.sql`, se ainda nao foi aplicado.
2. `supabase/migrations/add_partner_briefing.sql`, se os campos de parceiro ainda nao existirem.
3. `supabase/migrations/add_partner_notifications.sql`, para avisos internos de briefing e grants explicitos ao papel `authenticated`.
4. `supabase/migrations/add_access_control.sql`, para papeis, permissoes individuais, auditoria, bloqueio de autoelevacao e cache offline seguro por acesso.
5. `supabase/migrations/add_push_notifications.sql`, para tokens Android por usuario, fila de entrega e notificacoes remotas de briefing/retorno.

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

Para este projeto, cadastre as variaveis do Supabase e as variaveis do provider de IA em Production, Preview e Development. Nao cadastre `VERCEL_OIDC_TOKEN` manualmente. `SUPABASE_SERVICE_ROLE_KEY` deve ser adicionada apenas ao ambiente server-side quando convites por e-mail ou push Android estiverem habilitados.

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

`AI_REQUEST_TIMEOUT_MS=30000` define o limite server-side das chamadas ao provider. A chave continua somente no backend.

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

Modelo padrao: `gemini-3.1-flash-lite`. Use Gemini para a analise server-side de prints/imagens.

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

## Notificacoes Push Android

As notificacoes remotas abrangem as atividades comerciais que ja possuem eventos seguros no banco: briefing ou visita atribuidos/alterados para parceiros e retorno de visita enviado pelo parceiro ao responsavel pelo lead. A entrega e feita para dispositivos Android registrados pelo proprio usuario; a notificacao apenas abre uma tela do CRM e nunca envia mensagens ou altera leads automaticamente.

1. Aplique `supabase/migrations/add_push_notifications.sql` apos a migration de controle de acesso.
2. No [Firebase Console](https://console.firebase.google.com/), crie ou selecione o projeto e cadastre o app Android `br.com.novaforma.crm`.
3. Baixe `google-services.json` e coloque-o em `android/app/google-services.json`. O arquivo ja esta no `.gitignore`.
4. Mantenha `NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS=false` e `NEXT_PUBLIC_ANDROID_FIREBASE_CONFIGURED=false` ate o APK/AAB ser reconstruido com `google-services.json`. Ative as duas variaveis como `true` somente depois de configurar Firebase no Android.
4. Crie uma service account com permissao para Firebase Cloud Messaging. Na Vercel, em **Project Settings > Environment Variables**, configure em Production (e Preview, se desejar):

```env
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVER_ONLY
PUSH_WEBHOOK_SECRET=UM_SEGREDO_FORTE_E_ALEATORIO
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

5. Crie no Supabase Dashboard uma **Database Webhook** de `INSERT` para a tabela `partner_notifications`:
   - URL: `https://nova-forma-crm.vercel.app/api/internal/push/partner-notification`
   - Header: `x-push-webhook-secret`
   - Valor do header: o mesmo `PUSH_WEBHOOK_SECRET` da Vercel.
6. Faça redeploy da Vercel e gere novamente o APK depois de adicionar o arquivo Firebase.
7. No Android 13 ou superior, entre no CRM e aceite a permissao de notificacoes. Ao atribuir um briefing a Bruno ou Rafael, o token registrado por aquele usuario recebera a notificacao.

Nao configure nenhuma dessas variaveis com `NEXT_PUBLIC_`. Sem Firebase, webhook e APK reconstruido, o CRM mantem os avisos internos, mas push remoto nao sera entregue.
Sem Firebase no APK, deixar push nativo ativo pode impedir o registro correto; por isso o padrao seguro e manter `NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS=false` e `NEXT_PUBLIC_ANDROID_FIREBASE_CONFIGURED=false`.
