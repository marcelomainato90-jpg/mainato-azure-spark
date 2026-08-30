import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, ImagePlus, Volume2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mainato GPT Super — Assistente de IA em azul e preto" },
      {
        name: "description",
        content:
          "Mainato GPT Super: converse com uma IA rápida e inteligente em português. Imagens, voz e respostas em tempo real.",
      },
      { property: "og:title", content: "Mainato GPT Super" },
      {
        property: "og:description",
        content: "IA em português com imagens, voz e respostas em tempo real.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Zap, title: "Respostas em tempo real", text: "Streaming instantâneo, sem esperas." },
  { icon: ImagePlus, title: "Imagens e fotos", text: "Envie imagens ou tire fotos para analisar." },
  { icon: Volume2, title: "Responde em voz", text: "Ouça as respostas com voz natural." },
];

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat", replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-16 text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] halo" />
      <div className="relative z-10 w-full max-w-2xl text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
          <Sparkles className="size-6 text-primary-foreground" />
        </div>
        <h1 className="mt-6 text-4xl font-bold sm:text-6xl">
          Mainato <span className="text-brand-gradient">GPT Super</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
          A sua IA em português — rápida, inteligente e pronta para conversar por texto,
          imagem ou voz.
        </p>

        <button
          onClick={() => navigate({ to: "/auth" })}
          disabled={checking}
          className="mt-8 inline-flex items-center justify-center rounded-2xl bg-brand-gradient px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow transition-opacity disabled:opacity-50"
        >
          {checking ? "A carregar..." : "Entrar com Google"}
        </button>

        <div className="mt-12 grid gap-3 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-surface/80 p-5 text-left"
            >
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-3 text-sm font-semibold">{f.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
