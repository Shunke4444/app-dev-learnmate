import { z } from "zod";

export const ChatRole = z.enum(["system", "user", "assistant"]);
export type ChatRole = z.infer<typeof ChatRole>;

export const ChatMessage = z.object({
  role: ChatRole,
  content: z.string().min(1).max(20_000),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ChatRequest = z.object({
  messages: z.array(ChatMessage).min(1).max(40),
  // Optional persona / system override per call.
  system: z.string().max(4000).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

// ----- Quiz -----

export const QuizQuestion = z.object({
  prompt: z.string().min(1).max(800),
  code: z.string().max(2000).nullable().optional(),
  options: z.array(z.string().min(1).max(400)).length(4),
  answer: z.number().int().min(0).max(3),
  rationale: z.string().min(1).max(1200),
});
export type QuizQuestion = z.infer<typeof QuizQuestion>;

export const QuizPayload = z.object({
  questions: z.array(QuizQuestion).min(1).max(10),
});
export type QuizPayload = z.infer<typeof QuizPayload>;

export const QuizRequest = z.object({
  topic: z.string().min(2).max(500),
  count: z.number().int().min(1).max(10).optional(),
  source: z.string().max(20_000).optional(),
});
export type QuizRequest = z.infer<typeof QuizRequest>;

export const QUIZ_JSON_SCHEMA = {
  name: "quiz",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            prompt: { type: "string" },
            code: { type: ["string", "null"] },
            options: {
              type: "array",
              items: { type: "string" },
              minItems: 4,
              maxItems: 4,
            },
            answer: { type: "integer", minimum: 0, maximum: 3 },
            rationale: { type: "string" },
          },
          required: ["prompt", "code", "options", "answer", "rationale"],
        },
      },
    },
    required: ["questions"],
  },
} as const;

// ----- Research -----

export const ResearchSuggestion = z.object({
  type: z.enum(["spelling", "grammar", "clarity", "style"]),
  original: z.string().min(1).max(400),
  replacement: z.string().min(1).max(400),
  explanation: z.string().min(1).max(600),
});
export type ResearchSuggestion = z.infer<typeof ResearchSuggestion>;

export const ResearchPayload = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string().max(1200),
  suggestions: z.array(ResearchSuggestion).max(40),
});
export type ResearchPayload = z.infer<typeof ResearchPayload>;

export const ResearchRequest = z.object({
  text: z.string().min(10).max(20_000),
});
export type ResearchRequest = z.infer<typeof ResearchRequest>;

export const RESEARCH_JSON_SCHEMA = {
  name: "research_review",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      score: { type: "integer", minimum: 0, maximum: 100 },
      summary: { type: "string" },
      suggestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: {
              type: "string",
              enum: ["spelling", "grammar", "clarity", "style"],
            },
            original: { type: "string" },
            replacement: { type: "string" },
            explanation: { type: "string" },
          },
          required: ["type", "original", "replacement", "explanation"],
        },
      },
    },
    required: ["score", "summary", "suggestions"],
  },
} as const;
