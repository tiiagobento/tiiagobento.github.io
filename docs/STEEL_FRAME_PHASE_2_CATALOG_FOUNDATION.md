# Steel Frame: fundacao da Fase 2

Esta etapa cria a camada persistente, versionada e auditavel que conecta o
catalogo tecnico ao motor deterministico. Ela nao interpreta plantas, nao
publica regras por IA e nao aplica SQL automaticamente em nenhum projeto.

## Estado remoto observado em 2026-08-01

O diagnostico somente leitura foi executado com `npm.cmd run supabase:diagnose`.
Ele usa apenas `GET`, nao le linhas de negocio e nao mostra valores secretos.

| Evidencia | Resultado |
| --- | --- |
| URL e project ref configurados | Consistentes entre si (`ikxerhzztevwczprmfav`) |
| Auth settings | Endpoint respondeu `200` |
| Superficie REST do baseline | 22 de 28 tabelas esperadas expostas |
| Baseline ausente | push, regras tecnicas, composicoes tecnicas e assessments |
| Buckets conhecidos | `lead-files`, `steel-frame-documents` e `steel-frame-catalog` retornaram `NoSuchBucket` |
| Classificacao segura | Projeto parcial ou incompativel; nao e vazio |

Essas evidencias nao identificam o alvo como homologacao ou producao. Portanto,
nao foi executado bootstrap, migration, criacao de bucket, insercao ou alteracao
remota. Tambem nao e possivel atestar RLS, policies, triggers ou ownership por
uma chave publica sem sessao autenticada.

## Migration local preparada

`supabase/migrations/20260801000000_steel_frame_phase_2_catalog_foundation.sql`
possui um bloqueio inicial: ela aborta antes de qualquer DDL se o baseline de
estimativas, regras tecnicas, funcoes de permissao ou timestamps nao existir.

Ela acrescenta, sem remover tabelas ou registros:

- fontes tecnicas e metadados de documentos privados;
- variacoes comerciais de materiais e historico de coeficientes;
- relacoes de compatibilidade e camadas ordenadas de composicoes;
- campos aditivos nas regras, composicoes, reforcos e precos existentes;
- cenarios que apontam para a mesma geometria confirmada;
- snapshots imutaveis de catalogo e trilha de auditoria;
- bucket privado `steel-frame-catalog` com policies de catalog manager;
- RLS, indices, triggers de `updated_at`, protecoes de ciclo de vida e
  imutabilidade de snapshots.

Nenhuma regra, coeficiente, composicao, reforco ou preco aprovado e inserido
pela migration. Os documentos tecnicos sao tratados como metadados e arquivos
privados; normas protegidas nao devem ser copiadas para o banco.

## Camada de dominio local

`src/lib/steel-frame/catalog/` contem interfaces de repository, schemas Zod,
servicos puros e um adaptador Supabase. O motor continua sem importar Supabase.

As protecoes atuais incluem:

- validacao de `strategyType` e `parameters` pelo schema do motor antes da
  persistencia;
- bloqueio de regra nao aprovada em calculos finais;
- exigencia de fonte, documento, responsavel tecnico e vigencia na aprovacao;
- selecao de preco por override manual, fornecedor preferido, menor preco
  valido e, por ultimo, valor valido mais recente para revisao;
- verificacao de compatibilidade de materiais;
- snapshot canonico com SHA-256 para rastreabilidade.

O adaptador Supabase so usa o client publico autenticado e as policies RLS. Ele
nao usa service role e nao e acionado enquanto a migration nao estiver aplicada.

## Proximo gate remoto

1. No dashboard, confirme que o projeto selecionado e exclusivamente de
   homologacao e compare o Project ref com o diagnostico, sem compartilhar
   chaves.
2. Execute `supabase/verification/steel_frame_phase2_preflight.sql` no SQL
   Editor dessa homologacao.
3. Caso o retorno seja `partial_baseline_blocked`, aplique somente o baseline
   documentado em `STEEL_FRAME_HOMOLOGATION_BOOTSTRAP.md` em uma base realmente
   vazia. Nunca execute a sequencia em uma base parcial.
4. Execute novamente o preflight e prossiga somente com
   `READY_FOR_PHASE2_HOMOLOGATION`.
5. Aplique a migration da Fase 2, valide RLS/triggers/storage com tres perfis e
   execute `supabase/verification/steel_frame_phase2_catalog_postflight.sql`.
   So depois conecte a interface administrativa ao catalogo persistente.

## Validacao local realizada

```powershell
npm.cmd run typecheck
npm.cmd run test -- src/lib/steel-frame/catalog src/lib/steel-frame/phase2-preflight.test.ts
```

Os testes verificam a validacao de estrategia, aprovacao, preco, compatibilidade,
snapshot e o contrato estatico da migration. Eles nao substituem a validacao SQL
em Supabase homologado.
