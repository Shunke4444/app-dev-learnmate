import {
  ChatMessage,
  QUIZ_JSON_SCHEMA,
  QuizPayload,
  QuizRequest,
} from "@/lib/ai/schemas";
import { jsonChat, OpenRouterError } from "@/lib/ai/openrouter";
import { hasApiKey } from "@/lib/ai/models";
import { readCache, writeCache } from "@/lib/ai/cache";

export const runtime = "nodejs";

const SYSTEM =
  "You generate study quizzes for the LearnMate app. " +
  "Return STRICT JSON matching the provided schema — no commentary. " +
  "Write exactly N multiple-choice questions for the given topic. " +
  "Each question must have 4 distinct, plausible options and ONE correct answer (0-based index). " +
  "Include `code` only when the question requires a code block; otherwise set `code` to null. " +
  "Each `rationale` is one or two sentences explaining why the correct option is right.";

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

  const parsed = QuizRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const count = parsed.data.count ?? 5;
  const sourceBlock = parsed.data.source
    ? `\n\nUse the following notes as the primary source. Quote and probe ideas from them:\n"""\n${parsed.data.source.slice(0, 16_000)}\n"""`
    : "";

  const cacheInput = {
    topic: parsed.data.topic.trim(),
    count,
    source: parsed.data.source?.trim() ?? null,
  };
  const cached = await readCache<QuizPayload>("quiz", "quiz", cacheInput);
  if (cached.hit) {
    return Response.json(
      { ...cached.data, model: cached.model, cached: true },
      {
        headers: {
          "X-LearnMate-Model": cached.model,
          "X-LearnMate-Cache": "hit",
        },
      },
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content:
        `Generate ${count} multiple-choice quiz questions on the topic: "${parsed.data.topic}".` +
        sourceBlock +
        `\n\nReturn JSON: { "questions": [...] } with exactly ${count} items.`,
    },
  ];

  try {
    const { data: validated, model } = await jsonChat<QuizPayload>({
      job: "quiz",
      messages,
      schema: QUIZ_JSON_SCHEMA,
      signal: request.signal,
      validate: (candidate) => QuizPayload.safeParse(candidate).success,
    });

    void writeCache("quiz", "quiz", cacheInput, validated, model);

    return Response.json(
      { ...validated, model },
      {
        headers: {
          "X-LearnMate-Model": model,
          "X-LearnMate-Cache": "miss",
        },
      },
    );
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    if (err instanceof OpenRouterError) {
      const exhausted = err.retriable; // last error was retriable → whole chain failed retriably
      const status =
        err.status === 429 ? 429 : err.status >= 500 ? 503 : err.status;
      return Response.json(
        {
          error: exhausted
            ? "chain_exhausted"
            : err.status === 429
              ? "rate_limited"
              : "upstream",
          message: err.message,
          lastStatus: err.status,
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
