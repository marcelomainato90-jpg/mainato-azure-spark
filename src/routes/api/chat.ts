import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT =
  "Você é o Mainato GPT Super, um assistente de IA rápido, gentil e muito competente. " +
  "Responda no mesmo idioma do usuário (normalmente português). " +
  "Use markdown quando ajudar (listas, negrito, blocos de código). " +
  "Se lhe perguntarem quem o criou, projetou ou desenvolveu, responda que foi o Sr. Marcelo Carlos Mainato, " +
  "um jovem de 16 anos, e agradeça-lhe por isso.";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "AI não configurada." }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const body = (await request.json()) as {
          messages?: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
        };
        const raw = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
        const messages = raw.map((m) => {
          if (m.role === "user" && m.images && m.images.length > 0) {
            return {
              role: m.role,
              content: [
                ...(m.content ? [{ type: "text", text: m.content }] : []),
                ...m.images.slice(0, 5).map((url) => ({
                  type: "image_url",
                  image_url: { url },
                })),
              ],
            };
          }
          return { role: m.role, content: m.content };
        });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Lovable-API-Key": apiKey,
          },
          body: JSON.stringify({
            model: "google/gemini-3.7-flash",
            stream: true,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          const message =
            upstream.status === 429
              ? "Muitas mensagens em pouco tempo. Tente de novo em instantes."
              : upstream.status === 402
                ? "Créditos de IA esgotados. Adicione créditos no Lovable para continuar."
                : `Erro da IA (${upstream.status}). ${text.slice(0, 200)}`;
          return new Response(JSON.stringify({ error: message }), {
            status: upstream.status,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(upstream.body, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          },
        });
      },
    },
  },
});
