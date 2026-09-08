import { createFileRoute } from "@tanstack/react-router";

const STYLE_GUIDE =
  "Ultra high-end, award-winning professional image. Photorealistic when appropriate, " +
  "impeccable composition, cinematic lighting, rich depth of field, crisp micro-detail, " +
  "accurate anatomy and perspective, clean commercial-grade finish suitable for advertising, " +
  "billboards, magazine covers and brand campaigns. 4K quality, no watermark, no distortion, " +
  "no gibberish text. If text is required, render it perfectly legible and correctly spelled.";

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("x-openai-key")?.trim();
        if (!apiKey) {
          return new Response(
            JSON.stringify({
              error: "Adicione a sua chave da OpenAI nas Definições para criar imagens.",
            }),
            { status: 401, headers: { "content-type": "application/json" } },
          );
        }

        const body = (await request.json()) as {
          prompt?: string;
          stream?: boolean;
        };
        const prompt = (body.prompt ?? "").trim();
        if (!prompt) {
          return new Response(JSON.stringify({ error: "Descreva a imagem que quer criar." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const stream = body.stream !== false;

        const upstream = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt: `${prompt}\n\n${STYLE_GUIDE}`,
            size: "1024x1024",
            quality: "high",
            ...(stream ? { stream: true, partial_images: 1 } : {}),
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          const message =
            upstream.status === 401
              ? "A sua chave da OpenAI não é válida. Verifique-a nas Definições."
              : upstream.status === 429
                ? "A sua conta OpenAI atingiu o limite ou ficou sem saldo."
                : `Erro ao criar a imagem (${upstream.status}). ${text.slice(0, 200)}`;
          return new Response(JSON.stringify({ error: message }), {
            status: upstream.status,
            headers: { "content-type": "application/json" },
          });
        }

        if (!stream) {
          return new Response(upstream.body, {
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(upstream.body, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
          },
        });
      },
    },
  },
});
