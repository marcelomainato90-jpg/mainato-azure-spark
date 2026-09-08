const STORAGE_KEY = "mainato.openai.key";

/** Chave OpenAI do próprio utilizador, guardada apenas neste aparelho. */
export function getUserKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setUserKey(value: string): void {
  try {
    const clean = value.trim();
    if (clean) window.localStorage.setItem(STORAGE_KEY, clean);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignora */
  }
}

export function clearUserKey(): void {
  setUserKey("");
}

export const NO_KEY_MESSAGE =
  "Adicione a sua chave da OpenAI nas Definições para começar a usar a IA.";

/** Cabeçalhos com a chave do utilizador. Lança erro se não existir. */
export function keyHeaders(): Record<string, string> {
  const key = getUserKey();
  if (!key) throw new Error(NO_KEY_MESSAGE);
  return { "x-openai-key": key };
}
