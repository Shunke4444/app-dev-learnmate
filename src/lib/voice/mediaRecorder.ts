// MediaRecorder + VAD-style silence detection. Used as the audio source for the
// Whisper fallback engine when Web Speech isn't available (e.g. Brave / Arc).
//
// Public shape mirrors the parts of SpeechRecognition we care about so the
// outer controller in `recognition.ts` can swap engines transparently.

export type RecorderHandlers = {
  onLevel?: (level: number) => void;
  onSilence?: () => void;
  onError?: (msg: string) => void;
};

export type RecorderHandle = {
  stop: () => Promise<Blob>;
  cancel: () => void;
  get running(): boolean;
};

// Tunables. Web Speech ends an utterance after ~1.2s of silence — match that.
const SILENCE_THRESHOLD = 0.018;
const SILENCE_MS = 1100;
const MIN_UTTERANCE_MS = 350;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

export async function startRecording(
  handlers: RecorderHandlers = {},
): Promise<RecorderHandle> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia unavailable");
  }
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder unavailable");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.onerror = (e) => {
    const err = (e as unknown as { error?: Error }).error;
    handlers.onError?.(err?.message ?? "recorder-error");
  };

  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);
  const buf = new Uint8Array(analyser.frequencyBinCount);

  const startedAt = performance.now();
  let lastLoudAt = startedAt;
  let everLoud = false;
  let raf = 0;
  let running = true;
  let silenceFired = false;

  const tick = () => {
    if (!running) return;
    analyser.getByteFrequencyData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i];
    const avg = sum / buf.length / 255;
    handlers.onLevel?.(Math.min(1, avg * 2.5));
    const now = performance.now();
    if (avg > SILENCE_THRESHOLD) {
      lastLoudAt = now;
      everLoud = true;
    }
    if (
      !silenceFired &&
      everLoud &&
      now - startedAt > MIN_UTTERANCE_MS &&
      now - lastLoudAt > SILENCE_MS
    ) {
      silenceFired = true;
      handlers.onSilence?.();
    }
    raf = requestAnimationFrame(tick);
  };

  recorder.start(100);
  raf = requestAnimationFrame(tick);

  const cleanup = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };

  const stop = (): Promise<Blob> =>
    new Promise((resolve) => {
      if (!running) {
        resolve(new Blob(chunks, { type: recorder.mimeType }));
        return;
      }
      const finalize = () => {
        cleanup();
        resolve(new Blob(chunks, { type: recorder.mimeType }));
      };
      if (recorder.state === "inactive") {
        finalize();
        return;
      }
      recorder.onstop = finalize;
      try {
        recorder.stop();
      } catch {
        finalize();
      }
    });

  return {
    stop,
    cancel: () => {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
      cleanup();
    },
    get running() {
      return running;
    },
  };
}
