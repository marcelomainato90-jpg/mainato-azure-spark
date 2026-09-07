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
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "IA de imagem não configurada." }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const body = (await request.json()) as {
          prompt?: string;
          images?: string[];
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
        const refs = Array.isArray(body.images) ? body.images.slice(0, 3) : [];

        const content: Array<Record<string, unknown>> = [
          { type: "text", text: `${prompt}\n\n${STYLE_GUIDE}` },
          ...refs.map((url) => ({ type: "image_url", image_url: { url } })),
        ];

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image",
            messages: [{ role: "user", content }],
            modalities: ["image", "text"],
            ...(stream ? { stream: true } : {}),
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          const message =
            upstream.status === 429
              ? "Muitos pedidos em pouco tempo. Tente daqui a instantes."
              : upstream.status === 402
                ? "Créditos de IA esgotados. Adicione créditos para continuar a criar imagens."
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
