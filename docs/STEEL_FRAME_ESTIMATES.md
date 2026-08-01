# Orcamentos Steel Frame

## Estado atual

O modulo tem uma fundacao segura e auditavel e uma primeira interface operacional para fluxo manual:

- lista de orcamentos, criacao a partir de um lead ou manual e ficha de geometria;
- catalogo de materiais com preco inicial cadastrado por permissao;
- itens calculados por regra explicita, mao de obra, custos operacionais e composicao comercial;
- custo direto, preco minimo, preco recomendado e desconto maximo derivados somente dos dados salvos;
- upload privado de plantas, croquis, fotos e PDFs, com URL assinada curta para abertura;
- analise documental pelo Gemini, com rascunho editavel, confianca/evidencia e correcao humana auditada;
- aprovacao tecnica atomica que registra a decisao e congela a versao corrente;
- proposta comercial em PDF vetorial, calculada somente a partir dos custos e percentuais persistidos e vinculada a versao tecnica aprovada;
- navegacao por permissao e mensagens acionaveis quando a migration ainda nao estiver aplicada.

A migration continua deliberadamente manual: a aplicacao nao cria tabelas, buckets ou policies em um projeto Supabase sem autorizacao. A sincronizacao offline especifica de orcamentos continua em fase posterior.

## Aplicacao segura da migration

Antes de aplicar, mantenha a ordem abaixo no SQL Editor ou no Supabase CLI:

1. `supabase/schema.sql`
2. `supabase/migrations/add_partner_briefing.sql`
3. `supabase/migrations/add_partner_notifications.sql`
4. `supabase/migrations/add_access_control.sql`
5. `supabase/migrations/add_push_notifications.sql`
6. `supabase/migrations/ensure_primary_admin.sql`
7. `supabase/migrations/add_partner_commissions_and_lead_files.sql`
8. `supabase/migrations/add_permission_audit_details.sql`
9. `supabase/migrations/add_steel_frame_estimates.sql`
10. `supabase/migrations/add_steel_frame_technical_rules.sql`

A migration e aditiva e idempotente. Ela nao apaga leads, perfis, tarefas, interacoes ou arquivos existentes. Em especial, a relacao de um orcamento com um lead usa `ON DELETE SET NULL`, preservando o historico de precificacao caso um lead seja removido depois.

## Dominio criado

- `steel_frame_estimates` e `steel_frame_estimate_versions` para rascunhos, revisoes e congelamento de versoes aprovadas.
- `steel_frame_documents` e o bucket privado `steel-frame-documents` para plantas, croquis, fotos e PDFs de referencia.
- Jobs, extracoes, perguntas e correcoes de IA com confianca, evidencia, pagina e area de origem.
- Segmentos de parede e aberturas para calculo explicavel de area bruta, abatimentos e area liquida.
- Fornecedores, materiais, precos, composicoes e reforcos com parametros configuraveis.
- Itens calculados, mao de obra, custos operacionais e componentes comerciais.
- Aprovacoes e trilha de auditoria por orcamento/versao.

## Seguranca e permissoes

Todas as tabelas novas usam RLS. O acesso e determinado por `auth.uid()` e pelas permissoes existentes do CRM:

- Administradores com `estimates.manage_all` veem e administram toda a carteira.
- Usuarios comerciais recebem acesso aos proprios orcamentos, ao catalogo e aos dados financeiros que precisam para trabalhar.
- Revisores tecnicos precisam de permissao explicita e atribuicao em `technical_responsible_id`.
- Parceiros nao recebem permissao padrao para ver orcamentos ou financeiros. Um administrador pode conceder `estimates.view_assigned` de forma individual quando o acesso for realmente necessario; custos, margem e precos continuam protegidos por `estimates.financials.view`.

Versoes aprovadas ou congeladas nao podem ser alteradas. Alteracoes em rascunhos de orcamento e versao entram em `steel_frame_audit_logs`.

Uma unica excecao controlada e o PDF de proposta: ele so pode ser anexado como documento `proposal` com visibilidade `internal`, pela propria conta que possui permissoes de financeiros e de geracao de proposta. O arquivo continua no bucket privado, fica associado a versao tecnica corrente e a mudanca para `proposal_generated` ocorre pela RPC `mark_steel_frame_proposal_generated`, que tambem registra auditoria. Parceiros sem permissao financeira nao conseguem listar, abrir ou baixar esse PDF.

## Motor deterministico

O codigo em `src/lib/steel-frame/calculator.ts` nao embute regras tecnicas, precos ou espessuras de Steel Frame. Ele so calcula a partir de valores cadastrados no catalogo e de parametros confirmados.

Regras aceitas:

- `STUD_BY_SPACING`
- `TRACK_BY_LINEAR_LENGTH`
- `BOARD_BY_AREA`
- `ROLL_BY_COVERAGE`
- `PACKAGE_BY_COVERAGE`
- `FASTENER_BY_AREA`
- `FASTENER_BY_BOARD`
- `FASTENER_BY_STUD`
- `FIXED_PER_OPENING`
- `FIXED_PER_PROJECT`
- `LINEAR_BY_OPENING`
- `MANUAL`

Se um parametro obrigatorio estiver ausente, o calculo falha de forma explicita. A interface futura deve pedir confirmacao ao usuario ou encaminhar a revisao tecnica, em vez de supor uma medida.

## Regras tecnicas versionadas

Depois de aplicar `add_steel_frame_technical_rules.sql`, a ficha do orcamento
tambem passa a registrar uma classificacao tecnica auditavel. Ela usa regras e
composicoes aprovadas, com fonte, versao, vigencia e responsavel tecnico, e
classifica o resultado como `ORCAMENTO AUTOMATICO`, `ORCAMENTO PRELIMINAR` ou
`REVISAO TECNICA OBRIGATORIA`.

Nenhum espacamento, perfil, carga ou limite normativo e fixado no codigo. A
classificacao automatica apenas confirma que dados ja revisados se enquadram em
um modelo aprovado; nao substitui projeto estrutural nem ART. Leia
`docs/STEEL_FRAME_TECHNICAL_RULES.md` antes de cadastrar ou aprovar um modelo.

## Preco comercial

O motor separa custo direto, reserva, impostos/comissoes sobre venda, margem e desconto permitido. O calculo retorna preco minimo, preco recomendado e teto de desconto sem reduzir o valor abaixo do minimo. Os percentuais devem vir da configuracao comercial autorizada; nenhum percentual de obra esta fixado no codigo.

## Documentos e IA

O bucket `steel-frame-documents` e privado. O navegador grava primeiro o metadado do documento, depois faz o upload no caminho `<usuario>/<orcamento>/<arquivo>` exigido pela policy, e remove esse metadado se o upload falhar. Aberturas usam URLs assinadas de curta duracao.

A rota `POST /api/ai/extract-estimate` recebe apenas IDs de documentos ja autorizados. No servidor ela resolve os objetos pelo cliente Supabase da sessao, baixa os bytes em memoria e chama o provider configurado. Para documentos, o fluxo aceita somente `gemini` (ou `mock` no desenvolvimento), pois PDFs, plantas e imagens sao enviados como `inlineData` para um provider multimodal. A chave de IA nunca vai ao navegador.

O resultado e validado por Zod, armazenado como uma extracao pendente de confirmacao e apresentado como campos editaveis. Somente o clique explicito em `Adicionar itens revisados` grava paredes e aberturas. Qualquer diferenca entre a sugestao e o valor confirmado gera uma entrada em `steel_frame_ai_corrections`.

## Proximas fases

1. Edicao/arquivamento de itens de custo, fornecedores, precos historicos, composicoes e reforcos.
2. Criacao guiada de uma nova versao quando uma proposta congelada precisar de revisao.
3. Sincronizacao offline de rascunhos e testes ponta a ponta autenticados.
