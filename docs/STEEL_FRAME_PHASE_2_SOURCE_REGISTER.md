# Steel Frame: registro de fontes da Fase 2

Este registro preserva a proveniencia das referencias recebidas para a Fase 2.
Ele nao publica regras tecnicas, coeficientes, composicoes, precos ou materiais
no banco.

## Fonte interna de arquitetura

| Campo | Valor |
| --- | --- |
| Nome | `Base_Tecnica_Final_Orcamentos_Steel_Frame_Nova_Forma.pdf` |
| Tipo | Especificacao interna de arquitetura e governanca |
| Versao | 1.0 |
| Data declarada | 2026-08-01 |
| SHA-256 | `f73d60d1c9a5a76e9bc103869788b935d59eac8116f3280eadc6b179def2b8b6` |
| Local de referencia | Arquivo externo fornecido pelo responsavel do CRM |
| Estado de catalogo | A cadastrar em homologacao como fonte interna, sem publicacao automatica |

## Decisoes de implementacao extraidas

- O catalogo tecnico permanece separado do motor deterministico e de cada
  estimativa.
- Apenas regras, coeficientes, composicoes e compatibilidades validadas e
  publicadas podem alimentar orcamentos finais.
- Versoes aprovadas precisam ser imutaveis; revisoes criam uma nova versao e
  preservam o `supersedes_id` e o hash do conteudo.
- Snapshots devem conter versao do motor, versao do schema, dados canonicos e
  SHA-256 suficiente para reproduzir o calculo.
- Fontes licenciadas e documentos privados devem ficar em bucket privado com
  metadados de licenca, hash e autorizacao de acesso.
- A IA pode produzir evidencia, confianca e perguntas de confirmacao, mas nao
  aprova regras nem assume responsabilidade estrutural.

## Caso de calibracao

O documento consolida um caso de ampliacao sobre laje com lista manuscrita,
planta de cobertura e referencias de cotacao. Esse material sera representado
futuramente como fixture de calibracao `draft` ou `pending_validation`.

Nao serao publicados automaticamente como regra global:

- espacamento de montantes;
- proporcao de bloqueadores;
- reforcos ou limites de altura;
- consumo de placas, parafusos, basecoat ou cantoneiras;
- geometria, fator de cobertura ou plano de corte;
- precos de fornecedor.

Qualquer uso do caso deve gerar a comparacao "historico informado x calculo
parametrizado" e manter as pendencias tecnicas visiveis para revisao humana.

## Limite desta etapa

Leitura visual multipass, calibracao por escala, extracao geometrica e cadastros
reais de fontes continuam bloqueados ate que o preflight passe em um projeto
Supabase de homologacao confirmado. A migration aditiva da Fase 2 ja esta no
repositorio para revisao, mas sua aplicacao remota continua bloqueada por esse
mesmo gate.
