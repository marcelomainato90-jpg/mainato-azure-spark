import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Mainato GPT Super" },
      {
        name: "description",
        content: "Entre com a sua conta Google para conversar com o Mainato GPT Super.",
      },
      { property: "og:title", content: "Entrar no Mainato GPT Super" },
      {
        property: "og:description",
        content: "Login rápido e seguro com Google para usar o Mainato GPT Super.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat", replace: true });
    });
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Não foi possível entrar com o Google. Tente novamente.");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/chat", replace: true });
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background px-4 text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] halo" />
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-border bg-surface/80 p-8 text-center shadow-glow backdrop-blur">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
          <Sparkles className="size-5 text-primary-foreground" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">
          Mainato <span className="text-brand-gradient">GPT Super</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre com a sua conta Google para começar a conversar.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
            {error}
          </p>
        )}

        <button
          onClick={signIn}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm font-medium transition-colors hover:border-primary/60 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.9 0 3.2.8 3.9 1.5l2.7-2.6A9.6 9.6 0 0 0 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.8 0-.7-.1-1.2-.2-1.9H12z" />
          </svg>
          {loading ? "A entrar..." : "Continuar com Google"}
        </button>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Ao entrar, aceita conversar com uma IA que pode cometer erros.
        </p>
      </div>
    </div>
  );
}
