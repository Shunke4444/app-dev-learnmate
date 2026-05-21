import type { ChatMessage } from "./schemas";
import { modelsForJob, type Job } from "./models";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retriable: boolean,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

// Some free models wrap JSON in markdown fences or add a preamble before the
// JSON body. Try a balanced-brace extraction as a fallback to strict JSON.parse.
function tryParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // continue
  }
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function authHeaders(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new OpenRouterError("OPENROUTER_API_KEY missing", 500, false);
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4444",
    "X-Title": "LearnMate",
  };
}

async function callModel(
  model: string,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<Response> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  if (res.ok && res.body) return res;

  const status = res.status;
  let detail = "";
  try {
    detail = await res.text();
  } catch {
    // ignore
  }
  // 429 = rate limit, 5xx = transient. Both retriable on next model.
  const retriable = status === 429 || status >= 500;
  throw new OpenRouterError(
    `OpenRouter ${status} for ${model}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    status,
    retriable,
  );
}

// Try each model in order; on retriable error (429/5xx/network) advance to the next.
// Returns the first model's streaming response that succeeded.
export async function streamChat(opts: {
  job: Job;
  messages: ChatMessage[];
  signal: AbortSignal;
}): Promise<{ response: Response; model: string }> {
  const chain = modelsForJob(opts.job);
  let lastErr: OpenRouterError | null = null;

  for (const model of chain) {
    try {
      const response = await callModel(model, opts.messages, opts.signal);
      return { response, model };
    } catch (err) {
      if (err instanceof OpenRouterError) {
        lastErr = err;
        if (!err.retriable) throw err;
        continue;
      }
      // Network / abort: treat as retriable unless aborted.
      if ((err as { name?: string })?.name === "AbortError") throw err;
      lastErr = new OpenRouterError(
        `network error: ${(err as Error).message}`,
        503,
        true,
      );
      continue;
    }
  }

  throw lastErr ?? new OpenRouterError("no models available", 503, false);
}

// Non-streaming call that requests a strict JSON response (json_schema).
// Returns the parsed JSON object plus the model name that served it.
// Iterates the fallback chain on 429/5xx, exactly like streamChat.
export async function jsonChat<T = unknown>(opts: {
  job: Job;
  messages: ChatMessage[];
  schema: Readonly<{ name: string; strict?: boolean; schema: object }>;
  signal: AbortSignal;
  validate?: (data: T) => boolean;
}): Promise<{ data: T; model: string }> {
  const chain = modelsForJob(opts.job);
  let lastErr: OpenRouterError | null = null;

  for (const model of chain) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          model,
          messages: opts.messages,
          stream: false,
          response_format: { type: "json_schema", json_schema: opts.schema },
        }),
        signal: opts.signal,
      });

      if (!res.ok) {
        const status = res.status;
        let detail = "";
        try {
          detail = await res.text();
        } catch {
          // ignore
        }
        const retriable = status === 429 || status >= 500;
        lastErr = new OpenRouterError(
          `OpenRouter ${status} for ${model}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
          status,
          retriable,
        );
        if (!retriable) throw lastErr;
        continue;
      }

      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = body.choices?.[0]?.message?.content ?? "";
      if (!raw) {
        lastErr = new OpenRouterError(
          `empty completion from ${model}`,
          502,
          true,
        );
        continue;
      }

      const data = tryParseJson<T>(raw);
      if (data == null) {
        lastErr = new OpenRouterError(
          `model ${model} returned non-JSON content`,
          502,
          true,
        );
        continue;
      }
      if (opts.validate && !opts.validate(data)) {
        lastErr = new OpenRouterError(
          `model ${model} returned JSON that failed validation`,
          502,
          true,
        );
        continue;
      }
      return { data, model };
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") throw err;
      if (err instanceof OpenRouterError) {
        lastErr = err;
        if (!err.retriable) throw err;
        continue;
      }
      lastErr = new OpenRouterError(
        `network error: ${(err as Error).message}`,
        503,
        true,
      );
    }
  }

  throw lastErr ?? new OpenRouterError("no models available", 503, false);
}

// Convert OpenRouter's SSE byte stream into a plain UTF-8 text stream of
// just the assistant's incremental content. The browser consumes this with
// response.body.getReader() — no SSE parsing needed client-side.
export function sseToTextStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const rawLine = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!rawLine.startsWith("data:")) continue;
            const data = rawLine.slice(5).trim();
            if (!data || data === "[DONE]") continue;

            try {
              const json = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const piece = json.choices?.[0]?.delta?.content;
              if (piece) controller.enqueue(encoder.encode(piece));
            } catch {
              // Ignore malformed keepalive frames.
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
  });
}
