# Nova Forma CRM

Aplicacao web para organizar leads da Nova Forma Steel Frame, qualificar oportunidades, acompanhar visitas, follow-ups, orcamentos e obras fechadas.

## Stack

- Next.js com App Router
- TypeScript, React e Tailwind CSS v4
- Componentes no estilo shadcn/ui
- Supabase Auth, Supabase Postgres e Row Level Security
- React Hook Form, Zod, TanStack Table, Recharts, Sonner, date-fns e lucide-react

## Instalar e rodar localmente

```bash
cd E:\NovaFormaCRM
npm install
npm run dev
```

Abra `http://localhost:3000`.

O app exige Supabase configurado. Sem as variaveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, login, cadastro e CRUD nao usam dados falsos.

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Execute todo o arquivo `supabase/schema.sql`. Esse arquivo ja inclui Auth profiles, CRM, RLS, automacoes, briefing de visita e painel do parceiro.
4. Se o banco ja existia antes da area do parceiro, execute tambem `supabase/migrations/add_partner_briefing.sql` uma vez.
5. Copie `.env.example` para `.env.local`.
6. Preencha as variaveis:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica

# Compatibilidade opcional com a chave publicavel nova:
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel

# Opcional e apenas backend. Nao exponha no frontend.
# SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
```

7. Reinicie o servidor local.
8. Acesse `/register` para criar o primeiro usuario.

## Popular dados de exemplo no Supabase

Depois de criar um usuario em `/register`, copie o UUID dele em Supabase Auth > Users e execute no SQL Editor:

```sql
select public.seed_nova_forma_demo('UUID_DO_USUARIO_AQUI');
```

A funcao tambem pode ser chamada como RPC por um usuario autenticado com `select public.seed_nova_forma_demo();`. Se o usuario ja tiver leads ou templates, ela nao duplica os dados.

## Banco e seguranca

O SQL cria:

- `profiles`
- `leads`
- `interactions`
- `tasks`
- `message_templates`
- campos de parceiro/Bruno em `leads`
- RPC segura `partner_update_visit_feedback`

Todas as tabelas usam Row Level Security. Usuario comum ve e altera apenas os proprios dados. Admin com `profiles.role = 'admin'` consegue operar o CRM. Parceiro com `profiles.role = 'partner'` ve apenas leads atribuidos em `leads.partner_id` e registra retorno pela RPC segura.

Regras automatizadas no banco:

- Status padrao: `Novo lead`
- Prioridade padrao: `Media`
- Calculo automatico de `lead_score`
- Atualizacao automatica de `updated_at`
- Atualizacao de `last_contact_at` ao registrar interacao
- Criacao automatica de tarefa quando uma interacao tiver proximo contato

## Rotas

- `/login`
- `/register`
- `/dashboard`
- `/leads`
- `/leads/new`
- `/leads/[id]`
- `/pipeline`
- `/tasks`
- `/templates`
- `/import-export`
- `/settings`
- `/leads/ai-import`
- `/leads/[id]/briefing`
- `/partner`

Rotas de CRM e parceiro sao privadas. Usuario deslogado e redirecionado para `/login`; usuario logado acessando `/login` ou `/register` vai para `/dashboard`.

## Importar CSV

Exemplo aceito em `/import-export`:

```csv
name,phone,source,status,priority,city,neighborhood,project_type,notes
Cliente Exemplo,+55 48 99999-9999,Site,Novo lead,Alta,Florianopolis,Centro,Casa em steel frame,Quer visita sem compromisso
```

Campos tambem aceitos em portugues: `nome`, `telefone`, `origem`, `prioridade`, `cidade`, `bairro`, `observacoes`.

## Uso diario

1. Cadastre todo contato novo em `/leads/new`.
2. Complete cidade, bairro, terreno, planta, metragem e prazo.
3. Use o score para separar lead frio, morno e quente.
4. Avance oportunidades no `/pipeline`.
5. Registre cada WhatsApp, ligacao, visita, reuniao ou orcamento como interacao.
6. Informe o proximo contato na interacao para criar tarefa automaticamente.
7. Use `/templates` para copiar mensagens ou abrir WhatsApp com texto pronto.
8. Acompanhe leads parados, visitas, follow-ups e tarefas atrasadas no dashboard.

## IA configuravel

A rota `/leads/ai-import` permite colar conversa ou enviar prints para gerar rascunhos editaveis de leads.

- O modo `IA via servidor` usa `/api/ai/extract-leads` e mantem a API key somente no backend.
- O modo `Puter no navegador` continua disponivel separadamente com `https://js.puter.com/v2/`.
- A analise acontece somente ao clicar em `Analisar com IA`.
- `/api/ai/generate-message` gera mensagens estruturadas para integracoes futuras do CRM.
- O painel `Nova Forma IA` no dashboard usa `/api/ai/daily-assistant` para explicar prioridades e mostrar cards de acao; a IA so recomenda acoes reais que ja estao no plano e o CRM mantem a ordem local se ela estiver indisponivel.
- A IA nao salva automaticamente: revise o rascunho e clique em `Salvar lead`.
- Imagens sao convertidas no navegador, enviadas ao servidor como `mimeType` + base64, e nao sao salvas no banco.
- Gemini e Mock aceitam prints diretamente. Groq, OpenRouter e Hugging Face so aceitam imagem quando o modelo configurado for visual; caso contrario o app mostra um erro amigavel pedindo Gemini ou Puter.

Configure um provider em `.env.local`:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=sua-chave-secreta
AI_REQUEST_TIMEOUT_MS=30000
```

Valores aceitos em `AI_PROVIDER`: `gemini`, `groq`, `openrouter`, `huggingface` e `mock`. Use `mock` sem chave para desenvolvimento. Se o provider escolhido nao tiver chave, a API retorna uma mensagem amigavel e nao fica em loading infinito.

As variaveis `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` e `HUGGINGFACE_API_KEY` nunca usam o prefixo `NEXT_PUBLIC` e nunca sao importadas em componentes client.

Para testar: crie/login com usuario real, acesse `/leads/ai-import`, cole uma conversa ou envie ate 5 prints PNG/JPG/WEBP de ate 5 MB cada, analise, revise e salve. Depois confira o lead em `/leads`.

## Admin e parceiro Bruno

Depois de criar seu usuario em `/register`, promova-o a admin no SQL Editor:

```sql
update public.profiles
set role = 'admin', name = 'Tiago'
where email = 'seu-email@exemplo.com';
```

Crie o usuario do Bruno em `/register` ou Supabase Auth e promova-o a parceiro:

```sql
update public.profiles
set role = 'partner', name = 'Bruno'
where email = 'email-do-bruno@exemplo.com';
```

Para atribuir uma visita, edite um lead como admin e preencha parceiro, data/status da visita e observacoes. Bruno acessa `/partner`, abre o briefing e registra o retorno. O admin ve o retorno na ficha do lead.

## Deploy na Vercel

Repositorio: `https://github.com/tiiagobento/tiiagobento.github.io`

Aplicacao: `https://nova-forma-crm.vercel.app`

1. Envie as alteracoes para a branch `main`.
2. A Vercel publica automaticamente o projeto `steelframe/nova-forma-crm`.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Nao configure `SUPABASE_SERVICE_ROLE_KEY` no frontend; use apenas se criar backend server-only no futuro.
5. Rode o deploy.
6. No Supabase, confirme que `supabase/schema.sql` foi aplicado antes de usar o CRM.

Nao use GitHub Pages: este projeto depende dos recursos de runtime do Next.js e do Supabase Auth.

Guia completo: `docs/DEPLOY.md`.

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm run android:sync
npm run android:debug
```

No PowerShell do Windows, se `npm` for bloqueado por execution policy, use `npm.cmd run ...`.

## Observacoes

- Links de WhatsApp sao sanitizados e assumem DDI Brasil `55` quando necessario.
- Leads sem contato ha mais de 3 dias aparecem com alerta, exceto fechados ou perdidos.
- Leads com `lead_score >= 70` aparecem como quentes.
- O layout e responsivo, com sidebar no desktop e navegacao inferior no mobile.

## PWA, offline e APK Android

O CRM possui manifesto PWA, service worker, app shell cacheado e banco local com IndexedDB/Dexie. Online, o Supabase continua sendo a fonte real dos dados. Offline, o app mostra dados ja sincronizados, permite operacoes basicas e cria uma fila local para sincronizar quando a conexao voltar.

A experiencia mobile foi ajustada para parecer app Android: bottom navigation fixa, menu Mais com logout e sincronizacao, safe-area para barras do sistema, cards compactos de leads, pipeline por chips de status no celular e tela offline com visual do CRM.

Documentacao:

- `docs/OFFLINE_MODE.md`
- `docs/ANDROID_APK.md`

APK debug:

```bash
npm run android:sync
npm run android:debug
```

Caminho esperado:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```
