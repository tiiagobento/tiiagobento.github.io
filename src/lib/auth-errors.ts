export function getAuthErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha invalidos.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (normalized.includes("email rate limit") || normalized.includes("rate limit")) {
    return "Limite de envio de e-mails do Supabase atingido. Aguarde alguns minutos e tente novamente.";
  }

  if (normalized.includes("user already registered") || normalized.includes("already registered")) {
    return "Este e-mail ja esta cadastrado. Entre com sua senha.";
  }

  if (normalized.includes("password should be at least") || normalized.includes("weak password")) {
    return "Use uma senha mais forte, com pelo menos 6 caracteres.";
  }

  return message;
}
