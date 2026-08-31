import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Sparkles,
  Square,
  Plus,
  Bot,
  User,
  ImagePlus,
  Camera,
  X,
  Volume2,
  VolumeX,
  LogOut,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSpeech } from "@/hooks/use-speech";
import {
  createConversation,
  loadMessages,
  makeTitle,
  saveMessage,
} from "@/lib/conversations";

export const Route = createFileRoute("/_authenticated/chat")({
  validateSearch: (search: Record<string, unknown>): { c?: string } =>
    typeof search['c'] === "string" ? { c: search['c'] } : {},
  head: () => ({
    meta: [
      { title: "Conversa — Mainato GPT Super" },
      {
        name: "description",
        content:
          "Converse com o Mainato GPT Super: respostas em tempo real, envio de imagens e leitura em voz alta.",
      },
      { property: "og:title", content: "Conversa no Mainato GPT Super" },
      {
        property: "og:description",
        content: "IA em português com respostas em tempo real, imagens e voz.",
      },
    ],
  }),
  component: Chat,
});


type Msg = { role: "user" | "assistant"; content: string; images?: string[] };

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.readAsDataURL(file);
  });
}

const SUGGESTIONS = [
  "Explique buracos negros de forma simples",
  "Escreva um e-mail profissional de cobrança",
  "Ideias de negócio para Maputo",
  "Corrija e melhore o meu texto",
];

function Chat() {
  const navigate = useNavigate();
  const { c: conversationParam } = Route.useSearch();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showVoices, setShowVoices] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const convRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const {
    supported: voiceSupported,
    speakingId,
    speak,
    stop,
    voices,
    voiceURI,
    selectVoice,
  } = useSpeech();

  // Reabrir uma conversa guardada (?c=<id>)
  useEffect(() => {
    if (!conversationParam) {
      convRef.current = null;
      setMessages([]);
      return;
    }
    convRef.current = conversationParam;
    loadMessages(conversationParam)
      .then((rows) =>
        setMessages(
          rows.map((r) => ({
            role: r.role,
            content: r.content,
            ...(r.images.length > 0 ? { images: r.images } : {}),
          })),
        ),
      )
      .catch(() => setError("Não foi possível abrir esta conversa."));
  }, [conversationParam]);

  const newChat = () => {
    abortRef.current?.abort();
    stop();
    convRef.current = null;
    setMessages([]);
    setPendingImages([]);
    setError(null);
    if (conversationParam) navigate({ to: "/chat", search: {}, replace: true });
  };

  const signOut = async () => {
    stop();
    abortRef.current?.abort();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };


  const addFiles = async (files: FileList | File[]) => {
    setError(null);
    const remaining = MAX_IMAGES - pendingImages.length;
    for (const file of Array.from(files).slice(0, Math.max(remaining, 0))) {
      if (!file.type.startsWith("image/")) {
        setError("Só são aceites imagens (JPG, PNG, etc.).");
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError("A imagem é demasiado grande (máx. 5 MB).");
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setPendingImages((prev) => [...prev, dataUrl]);
      } catch (e) {
        setError((e as Error).message);
      }
    }
    if (remaining <= 0) setError(`Máximo de ${MAX_IMAGES} imagens por mensagem.`);
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const content = text.trim();
    if ((!content && pendingImages.length === 0) || loading) return;
    setError(null);
    stop();
    const images = pendingImages;
    const userMsg: Msg = { role: "user", content };
    if (images.length > 0) userMsg.images = images;
    const next: Msg[] = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setPendingImages([]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Guardar a conversa e a mensagem do utilizador
    try {
      if (!convRef.current) {
        convRef.current = await createConversation(makeTitle(content, images.length > 0));
      }
      await saveMessage(convRef.current, "user", content, images);
    } catch {
      /* a conversa continua mesmo se o histórico falhar */
    }



    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Falha ao contactar a IA." }));
        throw new Error(data.error ?? "Falha ao contactar a IA.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            /* ignore partial chunks */
          }
        }
      }

      if (!acc) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: "_Sem resposta._" };
          return copy;
        });
      } else {
        if (convRef.current) {
          saveMessage(convRef.current, "assistant", acc).catch(() => {});
        }
        if (autoSpeak && voiceSupported) {
          setMessages((prev) => {
            speak(acc, prev.length - 1);
            return prev;
          });
        }
      }

    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setMessages((prev) =>
          prev[prev.length - 1]?.content ? prev : prev.slice(0, -1),
        );
      } else {
        setError((e as Error).message);
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] halo" />

      <header className="relative z-10 flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-semibold sm:text-lg">
              Mainato <span className="text-brand-gradient">GPT Super</span>
            </h1>
            <p className="text-[11px] text-muted-foreground">Inteligência em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {voiceSupported && (
            <button
              onClick={() => {
                if (autoSpeak) stop();
                setAutoSpeak((v) => !v);
              }}
              aria-pressed={autoSpeak}
              title={autoSpeak ? "Desligar leitura em voz" : "Ler respostas em voz alta"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                autoSpeak
                  ? "border-primary/70 bg-primary/15 text-foreground"
                  : "border-border bg-surface-2/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              {autoSpeak ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              Voz
            </button>
          )}
          <button
            onClick={() => {
              abortRef.current?.abort();
              stop();
              setMessages([]);
              setPendingImages([]);
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Novo
          </button>
          <button
            onClick={signOut}
            aria-label="Sair"
            title="Sair"
            className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-surface-2/70 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <h2 className="text-3xl font-bold sm:text-5xl">
              Olá, sou o <span className="text-brand-gradient">Mainato GPT Super</span>
            </h2>
            <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
              Pergunte qualquer coisa — ideias, código, textos, estudos ou conselhos.
            </p>
            <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-2xl border border-border bg-surface/80 p-4 text-left text-sm text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:text-foreground hover:shadow-glow"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-6 py-6">
            {messages.map((m, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border ${
                    m.role === "user" ? "bg-surface-2" : "bg-brand-gradient border-transparent"
                  }`}
                >
                  {m.role === "user" ? (
                    <User className="size-4 text-muted-foreground" />
                  ) : (
                    <Bot className="size-4 text-primary-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {m.role === "user" ? "Você" : "Mainato GPT Super"}
                  </p>
                  {m.images && m.images.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {m.images.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`Imagem enviada ${idx + 1}`}
                          className="h-28 w-28 rounded-xl border border-border object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {m.content ? (
                    <>
                      <div className="prose-chat text-[15px] leading-relaxed break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                      {m.role === "assistant" && voiceSupported && (
                        <button
                          onClick={() => (speakingId === i ? stop() : speak(m.content, i))}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                        >
                          {speakingId === i ? (
                            <>
                              <VolumeX className="size-3" /> Parar
                            </>
                          ) : (
                            <>
                              <Volume2 className="size-3" /> Ouvir
                            </>
                          )}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex gap-1 py-2">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="size-2 animate-bounce rounded-full bg-primary"
                          style={{ animationDelay: `${d * 0.15}s` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        <div className="sticky bottom-0 z-10 bg-gradient-to-t from-background via-background to-transparent pb-5 pt-3">
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="rounded-3xl border border-border bg-surface/90 shadow-glow backdrop-blur focus-within:border-primary/70">
            {pendingImages.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pt-3">
                {pendingImages.map((src, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={src}
                      alt={`Anexo ${idx + 1}`}
                      className="h-16 w-16 rounded-xl border border-border object-cover"
                    />
                    <button
                      onClick={() =>
                        setPendingImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-surface-2 border border-border text-muted-foreground hover:text-foreground"
                      aria-label="Remover imagem"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-1.5 p-2 pl-2">
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Anexar imagem"
              >
                <ImagePlus className="size-5" />
              </button>
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Tirar foto"
              >
                <Camera className="size-5" />
              </button>
              <textarea
                ref={taRef}
                value={input}
                rows={1}
                placeholder="Escreva a sua mensagem..."
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                    if (taRef.current) taRef.current.style.height = "auto";
                  }
                }}
                className="max-h-44 flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted-foreground"
              />
              {loading ? (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary transition-colors hover:bg-accent"
                  aria-label="Parar resposta"
                >
                  <Square className="size-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    send(input);
                    if (taRef.current) taRef.current.style.height = "auto";
                  }}
                  disabled={!input.trim() && pendingImages.length === 0}
                  className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-primary-foreground transition-opacity disabled:opacity-40"
                  aria-label="Enviar mensagem"
                >
                  <ArrowUp className="size-5" />
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Mainato GPT Super pode cometer erros. Verifique informações importantes.
          </p>
        </div>
      </main>
    </div>
  );
}
