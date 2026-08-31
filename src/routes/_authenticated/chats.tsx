import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquare, Trash2, ArrowLeft, Plus } from "lucide-react";
import {
  listConversations,
  deleteConversation,
  type Conversation,
} from "@/lib/conversations";

export const Route = createFileRoute("/_authenticated/chats")({
  head: () => ({
    meta: [
      { title: "As minhas conversas — Mainato GPT Super" },
      {
        name: "description",
        content: "Veja e reabra todas as suas conversas anteriores com o Mainato GPT Super.",
      },
      { property: "og:title", content: "As minhas conversas" },
      {
        property: "og:description",
        content: "Histórico completo das suas conversas no Mainato GPT Super.",
      },
    ],
  }),
  component: ChatsPage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChatsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listConversations()
      .then(setItems)
      .catch(() => setError("Não foi possível carregar as conversas."));
  }, []);

  const remove = async (id: string) => {
    setItems((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    try {
      await deleteConversation(id);
    } catch {
      setError("Não foi possível apagar a conversa.");
    }
  };

  return (
    <div className="relative min-h-[100dvh] bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] halo" />

      <header className="relative z-10 flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
        <Link
          to="/chat"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Voltar
        </Link>
        <h1 className="text-base font-semibold sm:text-lg">As minhas conversas</h1>
        <button
          onClick={() => navigate({ to: "/chat" })}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow"
        >
          <Plus className="size-3.5" />
          Nova
        </button>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        {error && (
          <p className="mb-4 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {error}
          </p>
        )}

        {items === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface/80" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface/80 p-10 text-center">
            <MessageSquare className="mx-auto size-6 text-primary" />
            <h2 className="mt-4 text-sm font-semibold">Ainda não tem conversas</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Comece uma conversa e ela fica guardada aqui automaticamente.
            </p>
            <button
              onClick={() => navigate({ to: "/chat" })}
              className="mt-5 rounded-2xl bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              Começar agora
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li
                key={c.id}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-surface/80 p-4 transition-colors hover:border-primary/60"
              >
                <MessageSquare className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDate(c.updated_at)}
                  </p>
                </div>
                <Link
                  to="/chat"
                  search={{ c: c.id }}
                  className="shrink-0 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Reabrir
                </Link>
                <button
                  onClick={() => remove(c.id)}
                  aria-label="Apagar conversa"
                  className="shrink-0 rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
