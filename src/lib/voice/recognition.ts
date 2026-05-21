// Thin wrapper around the browser's Web Speech `SpeechRecognition`.
// Web Speech is free and real-time in Chrome / Edge / Safari. Firefox needs a
// fallback (Whisper) — not implemented in this slice; we surface a clear flag
// via isSupported() so the UI can show a "voice not available here" state.

export type RecognitionEngine = "web-speech" | "unsupported";

// The browser exposes either standardised `SpeechRecognition` or the
// vendor-prefixed `webkitSpeechRecognition`. Both share the same shape.
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionResultList = ArrayLike<SpeechRecognitionResult>;

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function detectEngine(): RecognitionEngine {
  return getCtor() ? "web-speech" : "unsupported";
}

export function isSupported(): boolean {
  return detectEngine() !== "unsupported";
}

export type RecognitionHandlers = {
  onPartial?: (interim: string) => void;
  onFinal?: (text: string) => void;
  onError?: (code: string) => void;
  onEnd?: () => void;
};

export type RecognitionOptions = RecognitionHandlers & {
  continuous?: boolean;
  lang?: string;
};

// Returns a controller you can `start()` / `stop()`. Idempotent stop.
export function createRecognition(opts: RecognitionOptions = {}) {
  const Ctor = getCtor();
  if (!Ctor) {
    return {
      start() {
        opts.onError?.("unsupported");
      },
      stop() {},
      get running() {
        return false;
      },
    };
  }

  const rec = new Ctor();
  rec.lang = opts.lang ?? "en-US";
  rec.continuous = opts.continuous ?? true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let running = false;
  let stoppedByUser = false;

  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      const text = r[0]?.transcript ?? "";
      if (r.isFinal) opts.onFinal?.(text.trim());
      else interim += text;
    }
    if (interim) opts.onPartial?.(interim.trim());
  };

  rec.onerror = (e) => {
    opts.onError?.(e.error);
  };

  rec.onend = () => {
    // Chrome stops after each utterance even when continuous; auto-restart
    // unless the caller asked us to stop.
    if (!stoppedByUser && (opts.continuous ?? true)) {
      try {
        rec.start();
        return;
      } catch {
        // start() throws if already running — fall through
      }
    }
    running = false;
    opts.onEnd?.();
  };

  return {
    start() {
      if (running) return;
      stoppedByUser = false;
      running = true;
      try {
        rec.start();
      } catch (e) {
        running = false;
        opts.onError?.((e as Error).message || "start-failed");
      }
    },
    stop() {
      if (!running) return;
      stoppedByUser = true;
      try {
        rec.stop();
      } catch {
        // ignore
      }
    },
    get running() {
      return running;
    },
  };
}
