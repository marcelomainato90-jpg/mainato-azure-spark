import { flushSync } from "react-dom";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "imagens-geradas";

/** Palavras que indicam pedido de criação de imagem. */
const IMAGE_INTENT =
  /\b(cria|criar|crie|gera|gerar|gere|faz|faça|fazer|desenha|desenhar|desenhe|ilustra|ilustrar|ilustre|imagina|design)\b[^.?!]{0,60}\b(imagem|imagens|foto|fotos|cartaz|poster|pôster|banner|anúncio|anuncio|logotipo|logo|flyer|capa|ilustração|ilustracao|arte|thumbnail|wallpaper|mockup)\b/i;

export function looksLikeImageRequest(text: string): boolean {
  return IMAGE_INTENT.test(text);
}

type Frame = (dataUrl: string, isFinal: boolean) => void;

export async function streamGeneratedImage(
  prompt: string,
  refs: string[],
  onFrame: Frame,
  signal?: AbortSignal,
): Promise<void> {
  const post = (stream: boolean) =>
    fetch("/api/generate-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, images: refs, stream }),
      ...(signal ? { signal } : {}),
    });

  const res = await post(true);
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Não foi possível criar a imagem.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawAny = false;
  let sawFinal = false;
  let streamError: string | undefined;

  const handle = (eventName: string, payloadRaw: string) => {
    if (!payloadRaw || payloadRaw === "[DONE]") return;
    let payload: any;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return;
    }
    if (eventName === "error" || payload?.type === "error") {
      sawAny = true;
      streamError = payload?.error?.message ?? "Falha ao criar a imagem.";
      return;
    }
    const b64 = payload?.b64_json;
    if (typeof b64 !== "string") return;
    const isFinal =
      payload?.type === "image_generation.completed" ||
      payload?.type === "image_edit.completed" ||
      eventName === "image_generation.completed" ||
      eventName === "image_edit.completed";
    sawAny = true;
    flushSync(() => onFrame(`data:image/png;base64,${b64}`, isFinal));
    if (isFinal) sawFinal = true;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      let eventName = "";
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        const t = line.trimEnd();
        if (t.startsWith("event:")) eventName = t.slice(6).trim();
        else if (t.startsWith("data:")) dataLines.push(t.slice(5).trim());
      }
      if (dataLines.length > 0) handle(eventName, dataLines.join(""));
    }
  }

  if (streamError) throw new Error(streamError);

  if (!sawAny) {
    const replay = await post(false);
    if (!replay.ok) {
      const data = (await replay.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Não foi possível criar a imagem.");
    }
    const json = (await replay.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("A IA não devolveu nenhuma imagem.");
    onFrame(`data:image/png;base64,${b64}`, true);
    return;
  }
  if (!sawFinal) throw new Error("A criação da imagem foi interrompida.");
}

/** Guarda a imagem no armazenamento do utilizador e devolve a referência `sb:<caminho>`. */
export async function storeGeneratedImage(dataUrl: string): Promise<string | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return null;
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${userId}/${crypto.randomUUID()}.png`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/png", upsert: false });
    if (error) return null;
    return `sb:${path}`;
  } catch {
    return null;
  }
}

/** Converte referências `sb:<caminho>` em URLs assinados temporários. */
export async function resolveImageRefs(refs: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const ref of refs) {
    if (!ref.startsWith("sb:")) {
      out.push(ref);
      continue;
    }
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(ref.slice(3), 60 * 60 * 24);
    if (data?.signedUrl) out.push(data.signedUrl);
  }
  return out;
}
