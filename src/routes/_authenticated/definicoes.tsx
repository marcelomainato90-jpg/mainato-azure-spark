import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, Check, Trash2 } from "lucide-react";
import { getUserKey, setUserKey } from "@/lib/user-key";

export const Route = createFileRoute("/_authenticated/definicoes")({
  head: () => ({
    meta: [
      { title: "Definições — Mainato GPT Super" },
      {
        name: "description",
        content:
          "Guarde a sua própria chave da OpenAI para usar o Mainato GPT Super com a sua conta.",
      },
      { property: "og:title", content: "Definições — Mainato GPT Super" },
      {
        property: "og:description",
        content: "Use a sua própria chave da OpenAI no Mainato GPT Super.",
      },
    ],
  }),
  component: Definicoes,
});

function Definicoes() {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(getUserKey());
  }, []);

  const save = () => {
    setUserKey(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const remove = () => {
    setUserKey("");
    setValue("");
  };

  return (
    <div className="relative min-h-[100dvh] bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] halo" />
      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Link
          to="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar à conversa
        </Link>

        <h1 className="mt-6 flex items-center gap-3 font-display text-2xl font-bold sm:text-3xl">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
            <KeyRound className="size-5 text-white" />
          </span>
          A sua chave da OpenAI
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          O Mainato GPT Super usa a <strong>sua própria conta OpenAI</strong>. Crie uma chave em{" "}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-4"
          >
            platform.openai.com/api-keys
          </a>{" "}
          e cole-a aqui. A chave fica guardada apenas neste aparelho e nunca é partilhada com mais
          ninguém.
        </p>

        <div className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm sm:p-6">
          <label htmlFor="key" className="text-sm font-medium">
            Chave secreta
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3">
            <input
              id="key"
              type={show ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              spellCheck={false}
              className="h-12 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Esconder chave" : "Mostrar chave"}
              className="text-muted-foreground transition hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={save}
              disabled={!value.trim()}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-semibold text-white shadow-glow transition disabled:opacity-40"
            >
              {saved ? <Check className="size-4" /> : null}
              {saved ? "Guardada" : "Guardar chave"}
            </button>
            <button
              type="button"
              onClick={remove}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border/60 px-5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <Trash2 className="size-4" /> Remover
            </button>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Nota: como a chave é guardada neste aparelho, terá de a colar novamente noutro telemóvel
          ou computador.
        </p>
      </div>
    </div>
  );
}
