# Steel Frame: bootstrap seguro de homologacao

Este documento prepara uma base **nova e exclusiva de homologacao** para o
modulo Steel Frame. Ele nao autoriza aplicar SQL em producao e nao altera a
configuracao local automaticamente.

## Diagnostico seguro antes do SQL

Com `.env.local` configurado, execute:

```bash
npm.cmd run supabase:diagnose
```

O script faz apenas requisicoes `GET`, nunca imprime chaves e confirma a
superficie REST das tabelas e buckets conhecidos. Ele nao substitui o
preflight SQL autenticado: respostas REST nao comprovam RLS, policies,
triggers, ownership ou se o projeto e homologacao.

## Gate obrigatorio

1. Confirme no dashboard do Supabase que o projeto selecionado e de
   homologacao.
2. Compare o `Project ref` com o valor de `NEXT_PUBLIC_SUPABASE_URL` no
   `.env.local`, sem compartilhar chaves.
3. No SQL Editor desse projeto, execute
   `supabase/verification/steel_frame_phase2_preflight.sql`.
4. Interprete o resultado:
   - `READY_FOR_PHASE2_HOMOLOGATION`: o baseline atual existe e esta pronto
     para receber uma migration futura da Fase 2.
   - `empty_baseline_safe_for_documented_bootstrap`: o projeto esta vazio;
     aplique a ordem abaixo e execute o preflight novamente.
   - `partial_baseline_blocked` ou `BLOCKED`: pare. Nao execute
     `schema.sql` nem qualquer migration da Fase 2 nesse projeto.

O preflight e somente de leitura. Ele verifica tabelas, colunas, chaves
estrangeiras, indices, funcoes, RLS, policies, triggers e buckets do baseline.

## Bootstrap para projeto vazio

Use esta sequencia somente quando o preflight identificar um projeto realmente
vazio. Os SQLs historicos nao usam o formato temporal do Supabase CLI, por isso
nao devem ser reaplicados como migrations novas em um banco parcial.

1. `supabase/schema.sql`
2. `supabase/migrations/add_partner_briefing.sql`
3. `supabase/migrations/add_partner_notifications.sql`
4. `supabase/migrations/add_access_control.sql`
5. `supabase/migrations/ensure_primary_admin.sql`
6. `supabase/migrations/add_partner_commissions_and_lead_files.sql`
7. `supabase/migrations/add_permission_audit_details.sql`
8. `supabase/migrations/add_push_notifications.sql`
9. `supabase/migrations/add_steel_frame_estimates.sql`
10. `supabase/migrations/add_steel_frame_technical_rules.sql`
11. `supabase/migrations/20260801000000_steel_frame_phase_2_catalog_foundation.sql`

Essa ordem foi conferida contra as dependencias atuais:

- `schema.sql` cria o CRM base, Auth profiles, parceiros e primitivas de
  notificacao.
- briefing e notificacoes dependem de `profiles` e `leads`.
- controle de acesso depende dos recursos CRM e disponibiliza
  `has_permission`.
- administrador primario consolida as funcoes de papel e permissao usadas
  pelas migrations posteriores.
- comissoes, arquivos privados e auditoria dependem das permissões e de leads.
- push depende de notificacoes e perfil ativo.
- orcamentos dependem de acesso, parceiros e arquivos privados.
- regras tecnicas dependem de estimativas e versoes ja existentes.
- a fundacao da Fase 2 depende do baseline completo e possui uma guarda que
  interrompe sua execucao quando alguma tabela ou funcao obrigatoria faltar.

Execute o preflight depois do item 10 e antes do item 11. So aplique a
fundacao da Fase 2 quando ele retornar `READY_FOR_PHASE2_HOMOLOGATION` sem
bloqueios. Execute novamente o preflight apos o item 11 para validar as novas
tabelas, RLS, triggers e o bucket privado. Em seguida, execute
`supabase/verification/steel_frame_phase2_catalog_postflight.sql` para obter a
decisao `PHASE2_CATALOG_READY`.

## Verificacao funcional do baseline

Com o preflight aprovado e uma conta de homologacao autorizada, valide:

1. Perfil, login e uma permissao por papel.
2. Criacao e leitura de um lead de homologacao.
3. Criacao e leitura de uma estimativa em rascunho.
4. Criacao de uma versao da estimativa e validacao do trigger de imutabilidade.
5. Leitura de um material e de um preco vigente pelo catalogo atual.
6. Upload autorizado e URL assinada no bucket privado
   `steel-frame-documents`.
7. Negacao de leitura para um usuario sem permissao.

Nao reutilize dados de clientes ou o projeto de producao nesses testes.

## Referencias recebidas nesta etapa

Os PDFs, fotos, croquis e listas fornecidos pelo usuario sao fontes de
referencia historica. Eles nao devem criar automaticamente materiais aprovados,
coeficientes, espacamentos, reforcos, composicoes, regras de cobertura ou
precos. Quando o gate da Fase 2 for aberto, eles poderao entrar apenas como
fontes catalogadas ou fixtures `draft`/`pending_validation`, com origem,
versao, hash e revisao tecnica humana.

O registro atual dessas fontes esta em
`docs/STEEL_FRAME_PHASE_2_SOURCE_REGISTER.md`.
