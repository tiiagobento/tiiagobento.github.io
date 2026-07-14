export type AutomationLevel = "assisted" | "semi-automatic" | "automatic";

export const automationLevelOptions: Array<{
  value: AutomationLevel;
  title: string;
  description: string;
  recommended?: boolean;
}> = [
  {
    value: "assisted",
    title: "Assistido",
    description: "A IA recomenda e cada alteracao precisa de uma confirmacao explicita.",
  },
  {
    value: "semi-automatic",
    title: "Semiautomatico",
    description: "Organiza o dia, prepara mensagens e cria follow-ups depois da sua confirmacao.",
    recommended: true,
  },
  {
    value: "automatic",
    title: "Automatico",
    description: "Pode organizar prioridades e criar tarefas internas seguras. Comunicacoes e acoes sensiveis continuam exigindo confirmacao.",
  },
];

export function automationStorageKey(userId?: string | null) {
  return `novaforma:automation-level:${userId || "device"}`;
}

export function readAutomationLevel(userId?: string | null): AutomationLevel {
  if (typeof window === "undefined") return "semi-automatic";
  const value = window.localStorage.getItem(automationStorageKey(userId));
  return isAutomationLevel(value) ? value : "semi-automatic";
}

export function saveAutomationLevel(level: AutomationLevel, userId?: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(automationStorageKey(userId), level);
  window.dispatchEvent(new CustomEvent("novaforma:automation-level-changed", { detail: level }));
}

export function isAutomationLevel(value: unknown): value is AutomationLevel {
  return value === "assisted" || value === "semi-automatic" || value === "automatic";
}
