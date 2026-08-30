import { useCallback, useEffect, useRef, useState } from "react";

/** Síntese de voz natural do dispositivo (grátis, sem créditos). */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      const pt = voices.filter((v) => v.lang.toLowerCase().startsWith("pt"));
      const preferred =
        pt.find((v) => /natural|neural|google|enhanced|premium/i.test(v.name)) ??
        pt.find((v) => v.lang.toLowerCase() === "pt-pt") ??
        pt[0] ??
        voices.find((v) => /natural|neural|google/i.test(v.name)) ??
        voices[0];
      voiceRef.current = preferred ?? null;
    };

    pickVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (text: string, id: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/```[\s\S]*?```/g, " bloco de código. ")
        .replace(/[*_#>`~|]/g, "")
        .replace(/\[(.*?)\]\(.*?\)/g, "$1")
        .trim();
      if (!clean) return;
      const utter = new SpeechSynthesisUtterance(clean);
      if (voiceRef.current) utter.voice = voiceRef.current;
      utter.lang = voiceRef.current?.lang ?? "pt-PT";
      utter.rate = 1.02;
      utter.pitch = 1;
      utter.onend = () => setSpeakingId(null);
      utter.onerror = () => setSpeakingId(null);
      setSpeakingId(id);
      window.speechSynthesis.speak(utter);
    },
    [],
  );

  return { supported, speakingId, speak, stop };
}
