# Modo offline do Nova Forma CRM

O app usa uma abordagem offline-first pragmatica:

- online: Supabase continua sendo a fonte real dos dados, com Auth, RLS e Postgres.
- offline: o app mostra o ultimo snapshot sincronizado em IndexedDB e enfileira alteracoes locais.
- reconexao: a fila tenta sincronizar com Supabase usando a sessao real do usuario.

## Funciona offline

- abrir o app depois do primeiro carregamento online
- navegar por telas ja cacheadas pelo service worker
- ver leads, tarefas, interacoes e templates ja sincronizados no dispositivo
- criar lead
- editar lead
- excluir lead como operacao pendente
- criar tarefa
- concluir tarefa
- registrar interacao
- preparar/copiar mensagem de WhatsApp
- ver pendencias em Settings

## Exige internet

- login novo
- cadastro
- renovar sessao expirada
- sincronizar com Supabase
- IA via servidor
- Puter.js
- analise de prints por IA
- webhooks/servicos externos
- envio real pelo WhatsApp se o app/servico exigir rede

## Banco local

Arquivos principais:

- `src/lib/offline/db.ts`
- `src/lib/offline/offline-store.ts`
- `src/lib/offline/sync-queue.ts`
- `src/lib/offline/network-status.ts`

Tabelas locais:

- `leads`
- `tasks`
- `interactions`
- `message_templates`
- `profiles`
- `dashboard_snapshots`
- `pending_operations`

Cada operacao pendente guarda entidade, id local/remoto, usuario, tipo da operacao, payload, status, erro e tentativas.

## Conflitos

A regra atual e conservadora. Se a sincronizacao falhar, a operacao fica como `failed` e aparece em Settings. O usuario pode tentar novamente ou descartar a alteracao local. Sobrescrita automatica de conflitos complexos deve ser tratada futuramente por uma tela dedicada de revisao.

## Logout

O logout remove a sessao Supabase e limpa os dados locais do usuario neste dispositivo. Isso evita deixar dados comerciais sensiveis dentro do APK depois que a conta sai.

## Teste manual

1. Entre no app online.
2. Abra `/leads`, `/tasks`, `/templates` e `/settings`.
3. Desligue a internet do aparelho.
4. Crie um lead ou tarefa.
5. Veja a pendencia em `/settings`.
6. Ligue a internet.
7. Clique em `Sincronizar agora` ou aguarde a sincronizacao automatica.

## Experiencia mobile premium

No mobile/Android, o estado de rede aparece de forma compacta no header e tambem no menu Mais da bottom navigation.

Textos esperados:

- Online: `Online`
- Offline: `Offline - alteracoes serao salvas e sincronizadas depois`
- Sincronizando: `Sincronizando alteracoes...`
- Erro: `Algumas alteracoes precisam de atencao`

Quando o aparelho estiver offline, a tela de IA informa que a analise precisa de internet e orienta o usuario a cadastrar o lead manualmente para sincronizar depois. A tela `public/offline.html` tambem foi estilizada para parecer parte do app e oferece o botao `Tentar novamente`.
