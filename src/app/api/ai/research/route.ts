import {
  ChatMessage,
  RESEARCH_JSON_SCHEMA,
  ResearchPayload,
  ResearchRequest,
} from "@/lib/ai/schemas";
import { jsonChat, OpenRouterError } from "@/lib/ai/openrouter";
import { hasApiKey } from "@/lib/ai/models";
import { readCache, writeCache } from "@/lib/ai/cache";

export const runtime = "nodejs";

const SYSTEM =
  "You are an editor for LearnMate. Read the user's research draft and return STRICT JSON " +
  "matching the provided schema — no commentary outside the JSON. " +
  "Produce: (1) `score` 0-100 for overall writing quality, (2) a one-sentence `summary` of the draft, " +
  "(3) a `suggestions` list with concrete edits. Each suggestion has: " +
  "`type` (spelling | grammar | clarity | style), `original` (the exact substring to replace — must appear verbatim in the draft), " +
  "`replacement` (what to use instead), and `explanation` (one short sentence). " +
  "Prefer high-confidence fixes. If there are no issues, return an empty `suggestions` array and a high score. " +
  "Limit to at most 12 suggestions.";

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

  const parsed = ResearchRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const cacheInput = { text: parsed.data.text.trim() };
  const cached = await readCache<ResearchPayload>("research", "research", cacheInput);
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
        "Review this draft and return the JSON object described in the schema.\n\n" +
        '"""\n' +
        parsed.data.text +
        '\n"""',
    },
  ];

  try {
    const { data, model } = await jsonChat<unknown>({
      job: "research",
      messages,
      schema: RESEARCH_JSON_SCHEMA,
      signal: request.signal,
    });

    const validated = ResearchPayload.safeParse(data);
    if (!validated.success) {
      return Response.json(
        {
          error: "bad_output",
          message:
            "Model returned JSON that didn't match the schema: " +
            (validated.error.issues[0]?.message ?? "unknown"),
        },
        { status: 502 },
      );
    }

    void writeCache("research", "research", cacheInput, validated.data, model);

    return Response.json(
      { ...validated.data, model },
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
