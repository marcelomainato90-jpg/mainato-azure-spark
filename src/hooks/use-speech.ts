import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "mainato.voice";

/** Nomes de vozes portuguesas de boa qualidade (PT-PT). */
const GOOD_PT_NAMES =
  /(joana|duarte|catarina|raquel|ines|inês|fernanda|helia|hélia|natural|neural|enhanced|premium|siri)/i;
/** Vozes robóticas / "de telemóvel" a evitar. */
const POOR_NAMES = /(compact|eloquence|espeak|pico|robot|novelty|whisper|bells|organ|zarvox|trinoids)/i;

function scoreVoice(v: SpeechSynthesisVoice): number {
  const lang = v.lang.toLowerCase().replace("_", "-");
  let score = 0;
  if (lang === "pt-pt") score += 100;
  else if (lang.startsWith("pt")) score += 45; // pt-BR como recurso
  else return -1000;

  if (GOOD_PT_NAMES.test(v.name)) score += 30;
  if (/natural|neural|premium|enhanced/i.test(v.name)) score += 25;
  if (!v.localService) score += 20; // vozes de rede soam bem mais humanas
  if (POOR_NAMES.test(v.name)) score -= 60;
  if (v.default) score += 3;
  return score;
}

/** Divide o texto em frases curtas — evita cortes e dá entoação natural. */
function toChunks(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?…:;])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if ((current + " " + s).trim().length > 180) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current = `${current} ${s}`.trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

/** Limpa markdown e normaliza abreviaturas para leitura natural em PT-PT. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ". Bloco de código omitido. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/[*_>~|#]/g, "")
    .replace(/\bex\.\s/gi, "por exemplo ")
    .replace(/\betc\./gi, "etcétera")
    .replace(/\bp\.?ex\.?/gi, "por exemplo")
    .replace(/https?:\/\/\S+/g, " ligação ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, ". ")
    .trim();
}

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const queueRef = useRef<string[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);

    const saved = window.localStorage.getItem(STORAGE_KEY);

    const load = () => {
      const all = window.speechSynthesis.getVoices();
      if (all.length === 0) return;
      const pt = all
        .filter((v) => v.lang.toLowerCase().startsWith("pt"))
        .sort((a, b) => scoreVoice(b) - scoreVoice(a));
      setVoices(pt);
      const chosen = (saved && pt.find((v) => v.voiceURI === saved)) || pt[0] || null;
      voiceRef.current = chosen;
      setVoiceURI(chosen?.voiceURI ?? null);
    };

    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const selectVoice = useCallback(
    (uri: string) => {
      const v = voices.find((x) => x.voiceURI === uri);
      if (!v) return;
      voiceRef.current = v;
      setVoiceURI(uri);
      window.localStorage.setItem(STORAGE_KEY, uri);
    },
    [voices],
  );

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    cancelledRef.current = true;
    queueRef.current = [];
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback((text: string, id: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    cancelledRef.current = false;

    const clean = cleanForSpeech(text);
    if (!clean) return;

    queueRef.current = toChunks(clean);
    setSpeakingId(id);

    const next = () => {
      if (cancelledRef.current) return;
      const chunk = queueRef.current.shift();
      if (!chunk) {
        setSpeakingId(null);
        return;
      }
      const utter = new SpeechSynthesisUtterance(chunk);
      const voice = voiceRef.current;
      if (voice) utter.voice = voice;
      utter.lang = voice?.lang ?? "pt-PT";
      utter.rate = 0.97; // ritmo humano, sem pressa
      utter.pitch = 1.02;
      utter.volume = 1;
      utter.onend = () => window.setTimeout(next, 90); // respiração entre frases
      utter.onerror = () => {
        if (!cancelledRef.current) next();
      };
      synth.speak(utter);
    };

    next();
  }, []);

  return { supported, speakingId, speak, stop, voices, voiceURI, selectVoice };
}
