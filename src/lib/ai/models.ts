// Centralized free-model catalog for OpenRouter.
// Swap IDs here when OpenRouter retires a model.
// Verify availability at https://openrouter.ai/models?max_price=0

export type Job = "chat" | "notes" | "quiz" | "research" | "vision";

const ALLOW_PAID = process.env.OPENROUTER_ALLOW_PAID === "true";

function assertFree(id: string): string {
  if (ALLOW_PAID) return id;
  if (id.endsWith(":free") || id === "openrouter/free") return id;
  throw new Error(
    `Refusing to use non-free model "${id}". ` +
      `Set OPENROUTER_ALLOW_PAID=true to override.`,
  );
}

// Per-job recommended free models (May 2026 verified, per LearnMate_Build_Plan.md §2.2).
export const JOB_MODELS: Record<Job, { primary: string; fallbacks: string[] }> = {
  chat: {
    primary: "meta-llama/llama-3.3-70b-instruct:free",
    fallbacks: [
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "z-ai/glm-4.5-air:free",
      "deepseek/deepseek-v4-flash:free",
      "openrouter/free",
    ],
  },
  notes: {
    primary: "qwen/qwen3-next-80b-a3b-instruct:free",
    fallbacks: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-4-31b-it:free",
      "openrouter/free",
    ],
  },
  quiz: {
    primary: "openai/gpt-oss-120b:free",
    fallbacks: [
      "google/gemma-4-31b-it:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "openrouter/free",
    ],
  },
  research: {
    primary: "openai/gpt-oss-120b:free",
    fallbacks: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "openrouter/free",
    ],
  },
  vision: {
    primary: "google/gemma-4-31b-it:free",
    fallbacks: ["nvidia/nemotron-nano-12b-v2-vl:free", "openrouter/free"],
  },
};

// Resolve env overrides on every call (cheap, and lets tests poke env).
export function modelsForJob(job: Job): string[] {
  const base = JOB_MODELS[job];
  const envPrimary = process.env.OPENROUTER_MODEL?.trim();
  const envFallbacks = process.env.OPENROUTER_FALLBACKS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const primary = envPrimary || base.primary;
  const fallbacks = envFallbacks?.length ? envFallbacks : base.fallbacks;

  const chain = [primary, ...fallbacks];
  const seen = new Set<string>();
  return chain.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    assertFree(id);
    return true;
  });
}

export function hasApiKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}
