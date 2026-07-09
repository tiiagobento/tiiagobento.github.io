export async function copyTextToClipboard(text: string) {
  if (!text.trim()) {
    throw new Error("Nao ha texto para copiar.");
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Some browsers deny clipboard access in embedded or hardened contexts.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Nao foi possivel copiar automaticamente. Selecione e copie o texto manualmente.");
  }
}
