// Unified speech-recognition controller. Two engines:
//
// 1. `web-speech` — browser-native SpeechRecognition. Free + real-time + has
//    interim results, but in Chromium-Google forks (Brave, Arc) the cloud
//    backend is blocked and the API fires onerror({error:"network"}).
// 2. `whisper` — local Whisper via `@huggingface/transformers`. Free, no key,
//    works in every modern browser. Batch-only (no interim results) and slower
//    (~1-3s after silence on WebGPU). First load downloads ~40MB.
//
// `engine: "auto"` (default) tries web-speech first and transparently falls back
// to whisper on a network error. Callers see identical onFinal/onError surface.

import { startRecording, type RecorderHandle } from "./mediaRecorder";
import { transcribeBlob } from "./whisper";

export type RecognitionEngine = "web-speech" | "whisper" | "unsupported";

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
  if (typeof window === "undefined") return "unsupported";
  if (getCtor()) return "web-speech";
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  )
    return "whisper";
  return "unsupported";
}

export function isSupported(): boolean {
  return detectEngine() !== "unsupported";
}

export function isWebSpeechSupported(): boolean {
  return getCtor() !== null;
}

export type RecognitionHandlers = {
  onPartial?: (interim: string) => void;
  onFinal?: (text: string) => void;
  onError?: (code: string) => void;
  onEnd?: () => void;
  onEngineChange?: (engine: "web-speech" | "whisper") => void;
};

export type EngineChoice = "auto" | "web-speech" | "whisper";

export type RecognitionOptions = RecognitionHandlers & {
  continuous?: boolean;
  lang?: string;
  engine?: EngineChoice;
};

export type RecognitionController = {
  start: () => void;
  stop: () => void;
  readonly running: boolean;
  readonly engine: "web-speech" | "whisper";
};

// ---------------------------------------------------------------------------
// Web Speech implementation

function createWebSpeechController(opts: RecognitionOptions): RecognitionController {
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
      engine: "web-speech",
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
    if (!stoppedByUser && (opts.continuous ?? true)) {
      try {
        rec.start();
        return;
      } catch {
        // ignore
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
    engine: "web-speech",
  };
}

// ---------------------------------------------------------------------------
// Whisper implementation. Records mic → detects ~1s of silence → transcribes
// the segment → fires onFinal. In `continuous` mode, loops automatically.

function createWhisperController(opts: RecognitionOptions): RecognitionController {
  const continuous = opts.continuous ?? true;
  let recorder: RecorderHandle | null = null;
  let running = false;
  let stoppedByUser = false;
  let transcribing = false;

  async function startSegment() {
    try {
      recorder = await startRecording({
        onSilence: () => {
          // Auto-end this segment when speaker pauses.
          if (recorder) finishSegment();
        },
        onError: (msg) => {
          running = false;
          opts.onError?.(msg);
          opts.onEnd?.();
        },
      });
    } catch (e) {
      running = false;
      const msg = (e as Error).message || "mic-error";
      if (/Permission|denied|NotAllowed/i.test(msg)) {
        opts.onError?.("not-allowed");
      } else if (/NotFound|audio-capture/i.test(msg)) {
        opts.onError?.("audio-capture");
      } else {
        opts.onError?.(msg);
      }
      opts.onEnd?.();
    }
  }

  async function finishSegment() {
    if (!recorder || transcribing) return;
    const r = recorder;
    recorder = null;
    transcribing = true;
    try {
      const blob = await r.stop();
      if (blob.size > 0) {
        const text = await transcribeBlob(blob);
        if (text) opts.onFinal?.(text);
      }
    } catch (e) {
      opts.onError?.((e as Error).message || "transcribe-error");
    } finally {
      transcribing = false;
      if (running && continuous && !stoppedByUser) {
        startSegment();
      } else {
        running = false;
        opts.onEnd?.();
      }
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      stoppedByUser = false;
      startSegment();
    },
    stop() {
      if (!running) return;
      stoppedByUser = true;
      if (recorder) {
        finishSegment();
      } else if (!transcribing) {
        running = false;
        opts.onEnd?.();
      }
    },
    get running() {
      return running;
    },
    engine: "whisper",
  };
}

// ---------------------------------------------------------------------------
// Public factory with engine selection + auto fallback.

export function createRecognition(opts: RecognitionOptions = {}): RecognitionController {
  const choice = opts.engine ?? "auto";

  if (choice === "whisper" || (choice === "auto" && !isWebSpeechSupported())) {
    const ctrl = createWhisperController(opts);
    queueMicrotask(() => opts.onEngineChange?.("whisper"));
    return ctrl;
  }

  if (choice === "web-speech") {
    const ctrl = createWebSpeechController(opts);
    queueMicrotask(() => opts.onEngineChange?.("web-speech"));
    return ctrl;
  }

  // "auto" with web-speech available: wrap to detect network error and swap.
  let active: RecognitionController;
  let swapped = false;

  const wrappedHandlers: RecognitionOptions = {
    ...opts,
    onError: (code) => {
      if (!swapped && code === "network") {
        swapped = true;
        opts.onEngineChange?.("whisper");
        const whisper = createWhisperController(opts);
        active = whisper;
        whisper.start();
        return;
      }
      opts.onError?.(code);
    },
  };

  active = createWebSpeechController(wrappedHandlers);
  queueMicrotask(() => {
    if (!swapped) opts.onEngineChange?.("web-speech");
  });

  return {
    start() {
      active.start();
    },
    stop() {
      active.stop();
    },
    get running() {
      return active.running;
    },
    get engine() {
      return active.engine;
    },
  };
}
