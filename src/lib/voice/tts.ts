// Browser-native text-to-speech via Web Speech `SpeechSynthesis`. Free, no key.

export type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: string) => void;
};

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice(lang: string, preferredName?: string) {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (preferredName) {
    const match = voices.find((v) => v.name === preferredName);
    if (match) return match;
  }
  // Prefer the user's locale match, then any voice for the lang prefix, then default.
  const exact = voices.find((v) => v.lang === lang);
  if (exact) return exact;
  const prefix = lang.split("-")[0];
  const sameLang = voices.find((v) => v.lang.startsWith(prefix));
  if (sameLang) return sameLang;
  return voices[0] ?? null;
}

// Cancels any in-flight utterance and speaks `text`. Returns a stop fn.
export function speak(text: string, opts: SpeakOptions = {}) {
  if (!isTtsSupported() || !text.trim()) {
    opts.onError?.("unsupported");
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? 1;
  u.pitch = opts.pitch ?? 1;
  u.volume = opts.volume ?? 1;
  const lang = opts.lang ?? "en-US";
  u.lang = lang;

  const apply = () => {
    const voice = pickVoice(lang, opts.voiceName);
    if (voice) u.voice = voice;
    synth.speak(u);
  };

  // getVoices() can be empty until the `voiceschanged` event fires (esp. Chrome).
  if (synth.getVoices().length === 0) {
    const handler = () => {
      synth.removeEventListener("voiceschanged", handler);
      apply();
    };
    synth.addEventListener("voiceschanged", handler);
  } else {
    apply();
  }

  u.onstart = () => opts.onStart?.();
  u.onend = () => opts.onEnd?.();
  u.onerror = (e) => opts.onError?.(e.error || "tts-error");

  return () => synth.cancel();
}

export function cancelSpeech() {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}
