import { ChatRequest, type ChatMessage } from "@/lib/ai/schemas";
import {
  OpenRouterError,
  sseToTextStream,
  streamChat,
} from "@/lib/ai/openrouter";
import { hasApiKey } from "@/lib/ai/models";

export const runtime = "nodejs";

const DEFAULT_SYSTEM =
  "You are LearnMate, a friendly, voice-first study companion. " +
  "Keep replies concise (2–4 short paragraphs max) and prefer concrete examples. " +
  "You may use simple GitHub-flavored Markdown (bold, italics, bullet/numbered lists, " +
  "inline `code`, fenced code blocks, tables) — never raw HTML. " +
  "Do not claim to be any specific underlying model or company (e.g. GPT, Claude, OpenAI, Anthropic); " +
  "if asked, say you are LearnMate, a study assistant. " +
  "If you don't know something, say so plainly.";

export async function POST(request: Request) {
  if (!hasApiKey()) {
    return Response.json(
      { error: "missing_key", message: "OPENROUTER_API_KEY is not set on the server." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request", message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const sys: ChatMessage = {
    role: "system",
    content: parsed.data.system?.trim() || DEFAULT_SYSTEM,
  };
  const messages: ChatMessage[] = [sys, ...parsed.data.messages];

  try {
    const { response, model } = await streamChat({
      job: "chat",
      messages,
      signal: request.signal,
    });

    if (!response.body) {
      return Response.json({ error: "upstream", message: "no stream body" }, { status: 502 });
    }

    return new Response(sseToTextStream(response.body), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
        "X-LearnMate-Model": model,
      },
    });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    if (err instanceof OpenRouterError) {
      const status =
        err.status === 429 ? 429 : err.status >= 500 ? 503 : err.status;
      return Response.json(
        {
          error: err.status === 429 ? "rate_limited" : "upstream",
          message: err.message,
        },
        { status },
      );
    }
    return Response.json(
      { error: "unknown", message: (err as Error).message },
      { status: 500 },
    );
  }
}
