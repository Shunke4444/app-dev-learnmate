// Client-side attachment parser. Turns a File into plain text the AI can read.
// Supports: .txt / .md / .csv / .json / .html / .xml (and similar text MIME types)
// plus .pdf via pdfjs-dist. Images are accepted as filenames-only stubs — the
// free OpenRouter chat models we use don't have vision.
//
// Cap each file at ~18k chars so we stay under the per-message limit defined
// in `src/lib/ai/schemas.ts` (20_000).

export type ParsedAttachment = {
  name: string;
  kind: "text" | "pdf" | "image" | "unsupported";
  text: string;
  bytes: number;
  truncated: boolean;
};

const MAX_CHARS = 18_000;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB hard cap before we even try.

function clip(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_CHARS), truncated: true };
}

function isTextish(file: File): boolean {
  const t = file.type;
  if (t.startsWith("text/")) return true;
  if (t === "application/json") return true;
  if (t === "application/xml") return true;
  if (t === "application/javascript" || t === "application/x-yaml") return true;
  const name = file.name.toLowerCase();
  return /\.(txt|md|markdown|csv|tsv|json|xml|yaml|yml|html?|log|ini|conf|sql|py|js|ts|tsx|jsx|css|sh)$/.test(
    name,
  );
}

async function parsePdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Worker is served from /public so Next.js doesn't need to bundle it.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  const pieces: string[] = [];
  let charCount = 0;
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ");
    pieces.push(pageText);
    charCount += pageText.length;
    if (charCount > MAX_CHARS) break;
  }
  await pdf.destroy?.();
  return pieces.join("\n\n").trim();
}

export async function parseFile(file: File): Promise<ParsedAttachment> {
  if (file.size > MAX_BYTES) {
    throw new Error(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 8 MB.`,
    );
  }

  const name = file.name;
  const lowerName = name.toLowerCase();
  const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
  const isImage = file.type.startsWith("image/");

  if (isPdf) {
    const raw = await parsePdf(file);
    const { text, truncated } = clip(raw);
    return { name, kind: "pdf", text, bytes: file.size, truncated };
  }

  if (isTextish(file)) {
    const raw = await file.text();
    const { text, truncated } = clip(raw);
    return { name, kind: "text", text, bytes: file.size, truncated };
  }

  if (isImage) {
    return {
      name,
      kind: "image",
      text: `[Image attached: ${name}] — current model can't see images. Describe what you'd like extracted.`,
      bytes: file.size,
      truncated: false,
    };
  }

  return {
    name,
    kind: "unsupported",
    text: `[File attached: ${name}] — file type not supported for inline reading.`,
    bytes: file.size,
    truncated: false,
  };
}

// Compose the user message text with attachment content blocks appended.
export function attachToMessage(
  message: string,
  attachments: ParsedAttachment[],
): string {
  if (attachments.length === 0) return message;
  const blocks = attachments.map((a) => {
    const header = `--- attachment: ${a.name} (${a.kind}${a.truncated ? ", truncated" : ""}) ---`;
    return `${header}\n${a.text}\n--- end attachment ---`;
  });
  return [message.trim(), ...blocks].filter(Boolean).join("\n\n");
}
