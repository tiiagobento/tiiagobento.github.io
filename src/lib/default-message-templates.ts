import type { MessageTemplate } from "@/lib/types";

const now = "2026-07-08T00:00:00.000Z";

type TemplateGroup = {
  category: string;
  short: string;
  natural: string;
  consultative: string;
};

const groups: TemplateGroup[] = [
  {
    category: "Primeiro contato",
    short: "Oi, {nome}! Tudo bem? Aqui e da {empresa}. Vi seu contato sobre {tipo_obra} e queria entender rapidinho o que voce esta planejando pra te orientar melhor.",
    natural: "Oi, {nome}! Tudo bem? Aqui e {responsavel}, da {empresa}. Vi que voce chamou sobre {tipo_obra} em {cidade}. Voce ja tem terreno ou planta do projeto?",
    consultative:
      "Oi, {nome}! Obrigado pelo contato com a {empresa}. Antes de falar em valor ou prazo, queria entender melhor sua ideia de {tipo_obra}: onde seria a obra, se ja existe terreno e se voce ja tem alguma planta ou referencia.",
  },
  {
    category: "Pedido de informacoes",
    short: "Pra eu te orientar melhor, me confirma: a obra seria em {cidade}? Voce ja tem terreno ou planta/projeto?",
    natural: "{nome}, pra eu conseguir te passar uma orientacao mais certeira, me confirma cidade/bairro, se ja tem terreno, se tem planta e qual seria a ideia principal da obra?",
    consultative:
      "Perfeito, {nome}. Pra evitar te passar uma resposta solta, preciso entender o basico do projeto: local da obra, tipo de construcao, metragem aproximada, se ja tem terreno e se existe planta ou alguma referencia.",
  },
  {
    category: "Cliente com planta",
    short: "Perfeito, {nome}. Tendo a planta ja ajuda bastante. Se puder me enviar por aqui, eu vejo os pontos principais e te retorno com o proximo passo.",
    natural: "Boa, {nome}. Com a planta em maos a analise fica mais assertiva. Pode me mandar o arquivo ou foto por aqui? Eu avalio e ja te digo o melhor caminho.",
    consultative:
      "Excelente, {nome}. A planta permite avaliar metragem, ambientes, complexidade e pontos de steel frame com mais seguranca. Se puder enviar, eu organizo uma leitura inicial e encaminho {proximo_passo}.",
  },
  {
    category: "Cliente sem planta",
    short: "Sem problema, {nome}. Mesmo sem planta da pra entender a ideia inicial. Me conta o que voce pretende construir e em qual cidade/bairro seria.",
    natural: "{nome}, sem planta a gente ainda consegue comecar pela ideia geral. Me fala se seria casa, ampliacao, reforma ou outra obra, a cidade/bairro e uma metragem aproximada.",
    consultative:
      "Tudo bem, {nome}. Nessa fase, o ideal e levantar informacoes simples: objetivo da obra, local, se ja tem terreno, tamanho aproximado e alguma referencia do que voce imagina. Com isso eu consigo te orientar sem prometer um numero sem base.",
  },
  {
    category: "Preco por m2",
    short: "Entendo sua duvida, {nome}. O valor por m2 varia conforme projeto, acabamento, fundacao, metragem e escopo. Posso entender melhor sua ideia primeiro?",
    natural: "{nome}, da pra falar de valor, sim, mas o m2 muda bastante conforme a obra. Pra nao te passar um numero solto, me conta onde seria, metragem aproximada e se voce ja tem planta.",
    consultative:
      "Sua pergunta faz todo sentido, {nome}. Em steel frame, o custo depende de projeto, padrao de acabamento, fundacao, logistica, metragem e o que entra no escopo. Se voce me passar algumas informacoes, eu consigo te orientar com mais responsabilidade.",
  },
  {
    category: "Agendamento de visita",
    short: "{nome}, pelo que voce me passou, faz sentido marcarmos uma visita sem compromisso. Qual dia fica melhor pra voce?",
    natural: "{nome}, acho que uma visita no local vai ajudar bastante a entender o terreno e te orientar com seguranca. Voce tem algum dia ou horario melhor nesta semana?",
    consultative:
      "Pelo contexto da obra, {nome}, a visita tecnica parece o melhor proximo passo. Assim conseguimos avaliar acesso, terreno, entorno e duvidas do projeto antes de falar em orcamento. Qual periodo funciona melhor pra voce?",
  },
  {
    category: "Confirmacao de visita",
    short: "Fechado, {nome}. Ficou combinada nossa visita para {data_visita} as {horario_visita}. Qualquer ajuste me chama por aqui.",
    natural: "{nome}, confirmando nossa visita em {cidade} para {data_visita} as {horario_visita}. Se puder, deixe separado o que tiver de planta, fotos ou documento do terreno.",
    consultative:
      "Combinado, {nome}. A visita ficou para {data_visita} as {horario_visita}. Na hora, vamos entender o local, tirar duvidas e alinhar o melhor {proximo_passo} para o seu projeto.",
  },
  {
    category: "Pos-visita",
    short: "{nome}, obrigado por receber a gente hoje. Vou organizar as informacoes da visita e te retorno com o proximo passo certinho.",
    natural: "{nome}, obrigado pela visita de hoje. Vou revisar o que vimos no local e organizar as informacoes pra te passar o encaminhamento com calma.",
    consultative:
      "Obrigado por receber a equipe, {nome}. A visita ajudou a entender melhor o contexto da obra. Agora vou consolidar as informacoes tecnicas e comerciais para te orientar no proximo passo sem correria.",
  },
  {
    category: "Follow-up de orcamento",
    short: "Oi, {nome}! Tudo bem? Passando pra saber se voce conseguiu olhar o orcamento e se ficou alguma duvida.",
    natural: "Oi, {nome}! Conseguiu olhar o orcamento com calma? Se tiver qualquer duvida sobre escopo, prazo ou forma de execucao, posso te ajudar por aqui.",
    consultative:
      "Oi, {nome}. Estou retomando pra entender como voce avaliou o orcamento. As vezes vale ajustarmos escopo, etapa ou prioridade antes de tomar uma decisao. Ficou algum ponto que voce quer revisar?",
  },
  {
    category: "Cliente sem resposta",
    short: "Oi, {nome}! Passando so pra retomar nossa conversa. Voce ainda pretende seguir com a ideia de {tipo_obra}?",
    natural: "Oi, {nome}! Tudo bem? Vi que nossa conversa ficou parada. Voce ainda quer seguir avaliando {tipo_obra} ou prefere que eu te chame mais pra frente?",
    consultative:
      "{nome}, passando com tranquilidade pra entender se o projeto ainda esta nos seus planos. Se o momento mudou, tudo bem; posso deixar anotado e retomar quando fizer mais sentido pra voce.",
  },
  {
    category: "Reativacao",
    short: "Oi, {nome}! A gente tinha conversado sobre {tipo_obra}. Esse projeto ainda esta nos seus planos?",
    natural: "Oi, {nome}! Tudo bem? Retomando nosso contato antigo sobre {tipo_obra}. Queria saber se a ideia ainda esta de pe ou se mudou alguma coisa no projeto.",
    consultative:
      "Oi, {nome}. Estou revisando alguns contatos e lembrei da sua ideia de {tipo_obra}. Se o projeto ainda fizer sentido, posso te ajudar a reorganizar as informacoes e definir o proximo passo.",
  },
  {
    category: "Cliente interessado em visita",
    short: "{nome}, podemos marcar a visita, sim. Me confirma cidade/bairro e um melhor horario pra eu organizar com o responsavel tecnico.",
    natural: "Perfeito, {nome}. Se voce quer uma visita, me passa cidade, bairro e disponibilidade de horario. Assim eu verifico a agenda e ja te retorno com uma opcao.",
    consultative:
      "{nome}, a visita e uma boa escolha quando precisamos entender terreno, acesso, recuos ou detalhes da obra. Me confirma o local e a melhor janela de horario para organizarmos isso com seguranca.",
  },
  {
    category: "Cliente de Google Meu Negocio",
    short: "Oi, {nome}! Vi seu contato pelo Google. Voce busca informacoes sobre {tipo_obra} em {cidade}?",
    natural: "Oi, {nome}! Tudo bem? Vi que voce chegou ate a {empresa} pelo Google. Me conta rapidinho o que voce esta planejando e em qual cidade/bairro seria a obra.",
    consultative:
      "Oi, {nome}. Obrigado por chamar pelo Google. Pra eu te atender melhor, queria entender se voce esta comparando sistemas, buscando orcamento ou querendo avaliar viabilidade de uma obra em {cidade}.",
  },
  {
    category: "Cliente vindo do site",
    short: "Oi, {nome}! Recebi seu contato pelo site da {empresa}. Voce quer falar sobre {tipo_obra}?",
    natural: "Oi, {nome}! Tudo bem? Vi seu contato pelo site sobre {tipo_obra}. Pra eu seguir melhor, voce ja tem terreno, planta ou alguma referencia do que quer construir?",
    consultative:
      "Oi, {nome}. Vi seu pedido pelo site da {empresa}. Vou te ajudar a organizar as informacoes iniciais para entendermos viabilidade, escopo e melhor proximo passo sem te passar uma resposta generica.",
  },
  {
    category: "Cliente frio",
    short: "Oi, {nome}! Se ainda fizer sentido falar sobre {tipo_obra}, posso te ajudar a entender os primeiros passos.",
    natural: "Oi, {nome}. Sem pressa: queria saber se o projeto ainda e uma ideia futura ou se voce ja quer comecar a organizar terreno, planta e orcamento.",
    consultative:
      "{nome}, se o projeto ainda esta mais no comeco, tudo bem. Posso te orientar por etapas: entender ideia, confirmar local, avaliar planta e so depois falar de orcamento com mais base.",
  },
  {
    category: "Cliente quente",
    short: "{nome}, pelas informacoes que voce passou, ja da pra avancar para {proximo_passo}. Qual horario fica melhor pra alinharmos?",
    natural: "{nome}, como voce ja trouxe informacoes importantes, acho que podemos avancar. O proximo passo seria {proximo_passo}. Voce consegue falar hoje ou amanha?",
    consultative:
      "{nome}, seu caso ja tem sinais bons para avancarmos: local, interesse e dados iniciais. Pra nao perder ritmo, sugiro seguirmos com {proximo_passo} e deixarmos as proximas pendencias bem claras.",
  },
  {
    category: "Obra longe",
    short: "{nome}, como a obra fica em {cidade}, preciso confirmar alguns dados antes de organizar uma visita, pra nao fazer voce perder tempo.",
    natural: "{nome}, atendemos casos fora da regiao tambem, mas antes preciso entender local, escopo, planta e urgencia. Assim vejo se a visita faz sentido ou se primeiro avaliamos por aqui.",
    consultative:
      "Como a obra fica em {cidade}, {nome}, o ideal e fazermos uma triagem mais cuidadosa antes de deslocamento. Me envie o que tiver de planta, fotos do terreno e endereco aproximado para avaliarmos com responsabilidade.",
  },
  {
    category: "Solicitacao de fotos/planta",
    short: "{nome}, se puder me enviar planta, fotos do terreno ou referencias, ja ajuda bastante na avaliacao inicial.",
    natural: "Pra eu te orientar melhor, {nome}, pode me mandar por aqui o que tiver: planta, medidas, fotos do local, referencia de fachada ou imagem do modelo que voce imagina.",
    consultative:
      "{nome}, quanto mais contexto visual tivermos, melhor. Planta, fotos do terreno, medidas e referencias ajudam a entender complexidade, acesso e possiveis limitacoes antes de qualquer estimativa.",
  },
  {
    category: "Encaminhamento para parceiro/Bruno",
    short: "{nome}, vou encaminhar seu caso para analise tecnica e ja volto contigo com o melhor proximo passo.",
    natural: "{nome}, vou passar suas informacoes para o responsavel tecnico avaliar com mais cuidado. Assim a gente evita te dar uma resposta apressada e volta com uma orientacao melhor.",
    consultative: "Perfeito, {nome}. Vou encaminhar seu caso para o Bruno/responsavel tecnico com o resumo da obra. Ele avalia os pontos principais e eu retorno com {proximo_passo}.",
  },
  {
    category: "Fechamento/negociacao",
    short: "{nome}, se fizer sentido pra voce, podemos alinhar os ultimos pontos e deixar o proximo passo encaminhado.",
    natural: "{nome}, pra seguirmos com seguranca, queria revisar com voce escopo, prazo e proximas etapas. Assim evitamos duvidas antes de avancar.",
    consultative:
      "{nome}, estamos numa etapa boa para decisao. Minha sugestao e alinharmos escopo, prioridade, forma de execucao e pendencias finais para definir se seguimos com {proximo_passo}.",
  },
];

const variants = [
  ["short", "Curta"],
  ["natural", "Natural"],
  ["consultative", "Consultiva"],
] as const;

export const defaultMessageTemplates: MessageTemplate[] = groups.flatMap((group) =>
  variants.map(([key, label]) => ({
    id: `default-${slugify(group.category)}-${key}`,
    title: `${group.category} - ${label}`,
    category: group.category,
    content: group[key],
    created_at: now,
    updated_at: now,
  })),
);

export function isDefaultMessageTemplate(template: Pick<MessageTemplate, "id">) {
  return template.id.startsWith("default-");
}

export function getTemplatesWithDefaults(userTemplates: MessageTemplate[]) {
  const userKeys = new Set(userTemplates.map((template) => `${template.title.trim().toLowerCase()}::${template.category.trim().toLowerCase()}`));
  const defaults = defaultMessageTemplates.filter((template) => !userKeys.has(`${template.title.trim().toLowerCase()}::${template.category.trim().toLowerCase()}`));
  return [...userTemplates, ...defaults];
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
