// Local Whisper transcription via @huggingface/transformers (transformers.js).
// Free, no API key, works in any modern browser. First load downloads ~40MB and
// caches it; subsequent transcriptions are fast.
//
// We use `whisper-tiny.en` because it strikes the best size/accuracy trade for
// short conversational utterances. Switch to `whisper-base.en` if the user
// wants better accuracy at ~75MB. Multilingual = `Xenova/whisper-tiny`.

const MODEL_ID = "Xenova/whisper-tiny.en";

export type WhisperProgress =
  | { kind: "downloading"; file: string; loaded: number; total: number; percent: number }
  | { kind: "ready" }
  | { kind: "transcribing" };

type Transcriber = (
  audio: Float32Array,
  options?: Record<string, unknown>,
) => Promise<{ text: string }>;

let transcriberPromise: Promise<Transcriber> | null = null;
const loadProgressListeners = new Set<(p: WhisperProgress) => void>();

function emit(p: WhisperProgress) {
  loadProgressListeners.forEach((fn) => fn(p));
}

export function onWhisperProgress(fn: (p: WhisperProgress) => void) {
  loadProgressListeners.add(fn);
  return () => {
    loadProgressListeners.delete(fn);
  };
}

export function isWhisperLoaded(): boolean {
  return transcriberPromise !== null;
}

async function loadTranscriber(): Promise<Transcriber> {
  const mod = await import("@huggingface/transformers");
  const pipeline = mod.pipeline;

  const pipe = await pipeline(
    "automatic-speech-recognition",
    MODEL_ID,
    {
      progress_callback: (data: {
        status: string;
        file?: string;
        loaded?: number;
        total?: number;
        progress?: number;
      }) => {
        if (data.status === "progress" && data.file && data.total) {
          const loaded = data.loaded ?? 0;
          const total = data.total;
          emit({
            kind: "downloading",
            file: data.file,
            loaded,
            total,
            percent: Math.min(100, Math.round((loaded / total) * 100)),
          });
        } else if (data.status === "done" || data.status === "ready") {
          emit({ kind: "ready" });
        }
      },
    },
  );

  emit({ kind: "ready" });
  return pipe as unknown as Transcriber;
}

export function getTranscriber(): Promise<Transcriber> {
  if (!transcriberPromise) {
    transcriberPromise = loadTranscriber().catch((e) => {
      transcriberPromise = null;
      throw e;
    });
  }
  return transcriberPromise;
}

// Decode a recorded audio blob into a 16kHz mono Float32Array (what Whisper
// expects). Browsers can decode WebM/Opus, MP4/AAC, and WAV via AudioContext.
async function blobToMono16kFloat32(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const decodeCtx = new Ctx();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    decodeCtx.close().catch(() => {});
  }

  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const monoSource = new Float32Array(length);
  if (channels === 1) {
    monoSource.set(audioBuffer.getChannelData(0));
  } else {
    const c0 = audioBuffer.getChannelData(0);
    const c1 = audioBuffer.getChannelData(1);
    for (let i = 0; i < length; i++) monoSource[i] = (c0[i] + c1[i]) / 2;
  }

  const targetRate = 16000;
  if (audioBuffer.sampleRate === targetRate) return monoSource;

  // Resample via OfflineAudioContext at 16kHz.
  const Offline =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const targetLength = Math.ceil((length * targetRate) / audioBuffer.sampleRate);
  const offline = new Offline(1, targetLength, targetRate);
  const buffer = offline.createBuffer(1, length, audioBuffer.sampleRate);
  buffer.copyToChannel(monoSource, 0);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

export async function transcribeBlob(blob: Blob): Promise<string> {
  if (blob.size === 0) return "";
  const transcriber = await getTranscriber();
  emit({ kind: "transcribing" });
  const audio = await blobToMono16kFloat32(blob);
  // Short utterances; chunking + timestamps off for speed.
  const out = await transcriber(audio);
  const text = (out?.text ?? "").trim();
  emit({ kind: "ready" });
  return text;
}
