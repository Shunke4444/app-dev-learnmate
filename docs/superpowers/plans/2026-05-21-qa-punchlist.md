# QA Punch-List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the 9-item QA punch list for LearnMate without expanding scope: voice/recording bug fixes, audio upload, delete note, topbar cleanup, sidebar collapse, mascot favicon, quiz fallback hardening.

**Architecture:** This is an existing Next.js 16 App Router project (`learnmate/`). Changes are localized to existing files plus one new file (`src/app/icon.png`) and one Dexie helper. No new dependencies. Build command is `npm run build --webpack` (not Turbopack — Serwist requires webpack). Dev server on port 4444.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Zustand, Dexie, Headless UI, lucide-react, @huggingface/transformers (Whisper), OpenRouter (`:free` models only).

**Verification model:** No Jest/Vitest in repo. Each task is verified via:
- `npm run lint` (must end "0 errors, 0 warnings")
- `npm run build --webpack` (must succeed)
- Manual browser verification (steps stated per task)

**Hard constraint:** Every OpenRouter model added/referenced **MUST end in `:free`**. The `assertFree()` guard in `src/lib/ai/models.ts:9-16` will throw at runtime otherwise. Do not disable it. Do not set `OPENROUTER_ALLOW_PAID=true`.

---

## Task 0: Pre-flight — start dev server, capture baseline

**Files:** None modified.

- [ ] **Step 1: Start dev server in background**

Run: `cd C:\Users\jihad\desktop\appdev\learnmate && npm run dev` (background)
Expected output:
```
▲ Next.js 16.2.6
- Local:   http://localhost:4444
✓ Ready in <Xs>
```

- [ ] **Step 2: Open `http://localhost:4444/welcome` in Chrome**

Expected: welcome page renders, no console errors. If `useAuth` is hydrated and a user exists, you'll be redirected to `/home` — that's fine.

- [ ] **Step 3: Open DevTools → Console + Network. Keep open across all tasks.**

Expected: console clean (or only Next.js dev banner). Take a mental note of any unrelated warnings so they aren't blamed on later changes.

- [ ] **Step 4: Run lint baseline**

Run: `cd C:\Users\jihad\desktop\appdev\learnmate && npm run lint`
Expected: `0 errors, 0 warnings`. If pre-existing warnings exist, capture them — later tasks must not regress this baseline.

---

## Task 1: Investigate voice mode + recording bugs (read-only)

**Files:** None modified. Investigation only.

This task produces hypotheses + a chosen root cause that drives Task 8's fix.

- [ ] **Step 1: Reproduce in Chrome (Web Speech path)**

Sign in as guest. Navigate to `/notes`. Click "New note", name it "test", subject "general". Click Record. Speak: "this is a test of the voice recognition system". Observe:
- Engine pill should show "Cloud (Web Speech)".
- Live transcript should appear in the waveform panel.
- Click Stop. Transcript should remain.

Record what happened. Expected: works in Chrome.

- [ ] **Step 2: Reproduce in Brave (Whisper fallback path)**

Open `http://localhost:4444/notes` in Brave. Same steps as Step 1. Observe:
- Engine pill should swap from Cloud to "Local Whisper" after the first record attempt fails with `network`.
- Whisper progress bar should show "Loading voice model — X%".
- After download completes, transcript appears.

Record any anomalies: stuck percent, no swap, double-fire of engine pill, transcript empty.

- [ ] **Step 3: Reproduce in `/talk`**

Navigate to `/talk` in both Chrome and Brave. Press the mic FAB. Speak. Observe whether the same engine swap behavior occurs, and whether the recorder gets stuck after one utterance.

- [ ] **Step 4: Inspect Network tab during reproduction**

In Brave: filter Network → "openai/whisper" or "huggingface". The model bundle URLs should show progress events. If they stall, that's hypothesis #1 confirmed (download hang).

In Chrome with Web Speech blocked (you can simulate by going offline mid-session): observe whether `onerror({error:"network"})` swap path runs.

- [ ] **Step 5: Read `src/lib/voice/recognition.ts:285-322` once more with the observed behavior**

Pay attention to:
- The wrapper returned at line 309 has live getters that delegate to `active`, but `start()` and `stop()` only call the *current* `active`. After swap, the swap happens inside `wrappedHandlers.onError` (line 291), which reassigns `active` but does NOT call `start()` on the new controller until line 297 — confirm that `whisper.start()` actually executes in your repro.
- `onEngineChange` fires from two places: `queueMicrotask(() => opts.onEngineChange?.("web-speech"))` at line 305 AND inside the swap path at line 294. If swap happens fast enough, both fire.

- [ ] **Step 6: Document the chosen root cause**

Write a 3-bullet summary into a scratch comment block at the top of `src/lib/voice/recognition.ts` (or in a separate note — your call). This becomes the contract for Task 8.

Example:
```
/* ROOT CAUSE (Task 1 investigation, 2026-05-21):
   - In Brave, swap from web-speech to whisper works but onEngineChange fires twice,
     causing engine pill to flicker between Cloud and Local. UX bug, not data bug.
   - Whisper download progress never hits 100% on some runs because progress_callback
     emits "progress" but never "done" — emit({kind:"ready"}) only fires on first transcribe.
   - /talk and /notes both call createRecognition with engine: loadPreferredEngine(), so
     if previous session set "web-speech", Brave never tries whisper at all.
*/
```

- [ ] **Step 7: Commit investigation note (no code yet)**

```bash
git add src/lib/voice/recognition.ts
git commit -m "chore(voice): document QA-reported repro for engine-swap + progress bugs"
```

---

## Task 2: Investigate quiz generation failures (read-only)

**Files:** None modified. Investigation only.

- [ ] **Step 1: Reproduce quiz death**

Navigate to `/quiz`. Click "Generate". Try topic "Python loops", count 5. Observe network: a single POST to `/api/ai/quiz`. Inspect the response status and body.

- [ ] **Step 2: Repeat 5 times rapidly**

Click Generate 5 times in a row. Free-tier rate limits kick in fast. Record the failure: which error code, which model was last in the chain, what was the response body.

- [ ] **Step 3: Read server logs**

In the terminal where dev server is running, watch for OpenRouter error logs. The chain at `src/lib/ai/models.ts:37-44`:
- `openai/gpt-oss-120b:free` (primary)
- `google/gemma-4-31b-it:free`
- `qwen/qwen3-next-80b-a3b-instruct:free`
- `openrouter/free`

Note which models 429 first.

- [ ] **Step 4: Check current OpenRouter free catalog**

Open `https://openrouter.ai/models?max_price=0` in browser. Verify the 4 model IDs above still exist. Also note 2-3 additional `:free` models that look stable (high context, high rate limit). Common candidates as of May 2026:
- `meta-llama/llama-3.3-70b-instruct:free`
- `deepseek/deepseek-v4-flash:free`
- `nvidia/nemotron-nano-12b-v2-vl:free`
- `z-ai/glm-4.5-air:free`

Pick 1-2 additional `:free` models to add to the chain. **Every one MUST end in `:free`.**

- [ ] **Step 5: Test JSON-schema strict mode per model**

In a scratch terminal, curl OpenRouter directly to verify each model handles the QUIZ_JSON_SCHEMA. The schema is exported from `src/lib/ai/schemas.ts` — read it once.

Example curl (use your `.env.local` key):
```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen/qwen3-next-80b-a3b-instruct:free",
    "messages":[{"role":"user","content":"Return JSON: {\"ok\":true}"}],
    "response_format":{"type":"json_schema","json_schema":{"name":"test","strict":true,"schema":{"type":"object","properties":{"ok":{"type":"boolean"}},"required":["ok"]}}}
  }'
```
Expected: 200 with JSON content. If a model 400s on strict schema, it goes LAST in the chain or gets dropped.

- [ ] **Step 6: Document the new chain order in a scratch note**

Decide:
1. New primary (most reliable JSON-strict + good rate budget).
2. Fallback order (4-5 models, all `:free`).
3. Last resort: `openrouter/free` (generic router).

No commit yet — Task 9 applies the change.

---

## Task 3: Remove notification bell + search bar from AppShell

**Files:**
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Remove the notification button block**

In `src/components/AppShell.tsx` around lines 317-324, delete:
```tsx
              <button
                type="button"
                aria-label="Notifications"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-surface/55 text-foreground/80 ring-1 ring-white/5 hover:bg-surface"
              >
                <Bell size={16} />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-teal" />
              </button>
```

After this edit, the `ml-auto` flex container at line 316 contains only `<UserMenu compact />`.

- [ ] **Step 2: Remove the sidebar search input block**

In the same file around lines 270-280, delete:
```tsx
        <div className="mt-7 flex items-center gap-2 rounded-2xl bg-surface/50 px-3 py-2 ring-1 ring-white/5">
          <Search size={15} className="text-muted" />
          <input
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted/80 outline-none"
            placeholder="Search…"
            type="search"
          />
          <kbd className="rounded-md bg-black/30 px-1.5 py-0.5 text-[10px] text-muted ring-1 ring-white/5">
            ⌘K
          </kbd>
        </div>
```

The `Workspace` heading block immediately after should now have `mt-7` instead of `mt-6` to keep visual spacing. Change `<div className="mt-6 px-2 ...">Workspace</div>` to `<div className="mt-2 px-2 ...">Workspace</div>` (sidebar header has its own bottom margin already). Eyeball it in the browser — adjust if it looks too tight.

- [ ] **Step 3: Remove the now-unused imports**

In the import block at top of file (lines 7-18), delete `Bell,` and `Search,`. Final import set:
```tsx
import {
  Book,
  FileText,
  Home,
  LogOut,
  MessageSquare,
  Mic,
  Settings,
  Sparkles,
} from "lucide-react";
```

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: `0 errors, 0 warnings`. If TS complains about unused imports, you missed one — re-scan.

- [ ] **Step 5: Verify in browser**

Reload `/home`. Topbar should show breadcrumb on left, UserMenu avatar on right — no bell. Sidebar should show LearnMate header, then directly the "Workspace" label and nav items — no search box. Mobile breakpoint (DevTools → toggle device toolbar): bottom nav unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat(shell): remove notification bell and sidebar search per QA"
```

---

## Task 4: Add `deleteNoteSession` to Dexie layer

**Files:**
- Modify: `src/lib/db/dexie.ts`

- [ ] **Step 1: Add the delete helper**

Append after `getNoteSession` (around line 178 in `src/lib/db/dexie.ts`):

```typescript
export async function deleteNoteSession(id: number): Promise<void> {
  await db().transaction(
    "rw",
    db().noteSessions,
    db().quizzes,
    db().quizAttempts,
    async () => {
      await db().noteSessions.delete(id);
      const orphanQuizzes = await db()
        .quizzes.where("sourceNoteId")
        .equals(id)
        .toArray();
      const orphanIds = orphanQuizzes
        .map((q) => q.id)
        .filter((qid): qid is number => qid != null);
      if (orphanIds.length > 0) {
        await db().quizzes.bulkDelete(orphanIds);
        await db().quizAttempts.where("quizId").anyOf(orphanIds).delete();
      }
    },
  );
}
```

- [ ] **Step 2: Verify TypeScript build**

Run: `npm run build --webpack`
Expected: build succeeds. If TS errors mention Dexie generic types, double-check `Quiz["sourceNoteId"]` is `number | undefined` (it is — see `src/lib/db/dexie.ts:44`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/dexie.ts
git commit -m "feat(db): add deleteNoteSession with cascade to quizzes + attempts"
```

---

## Task 5: Wire delete-note button on each library card

**Files:**
- Modify: `src/app/notes/page.tsx`

- [ ] **Step 1: Import the delete helper + Trash icon**

In `src/app/notes/page.tsx` at line 4-17, add `Trash2` to the lucide imports:
```tsx
import {
  BookOpen,
  CircleStop,
  Clock,
  Eraser,
  Headphones,
  Loader2,
  Mic,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
```

At line 28-33, extend the dexie import:
```tsx
import {
  createNoteSession,
  deleteNoteSession,
  listNoteSessions,
  updateNoteSession,
  type NoteSession,
} from "@/lib/db/dexie";
```

- [ ] **Step 2: Add the delete handler**

Inside `NotesPage` function, after `refreshSessions` (around line 103), add:

```tsx
  async function handleDelete(s: NoteSession) {
    if (s.id == null) return;
    const ok = window.confirm(`Delete "${s.title}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteNoteSession(s.id);
      if (active?.id === s.id) {
        stopCapture();
        setActive(null);
      }
      await refreshSessions();
    } catch (e) {
      setErrorNote(`Couldn't delete: ${(e as Error).message}`);
    }
  }
```

- [ ] **Step 3: Add the Trash button to each library card**

Find the article element at line 452-491. Inside the relative-positioned card, immediately after the meta row that contains `<Clock />` (around line 460-466), insert a trash button. Replace lines 460-466:

From:
```tsx
                  <div className="relative flex items-center gap-2 text-[11px] text-muted">
                    <Clock size={12} />
                    {new Date(it.updatedAt).toLocaleString()}
                    <span className="ml-auto rounded-full bg-bg/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-white/5">
                      {it.subject}
                    </span>
                  </div>
```

To:
```tsx
                  <div className="relative flex items-center gap-2 text-[11px] text-muted">
                    <Clock size={12} />
                    {new Date(it.updatedAt).toLocaleString()}
                    <span className="ml-auto rounded-full bg-bg/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-white/5">
                      {it.subject}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete ${it.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(it);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-bg/35 text-muted opacity-0 ring-1 ring-white/5 transition group-hover:opacity-100 hover:bg-red/20 hover:text-red focus:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
```

- [ ] **Step 4: Verify in browser**

Reload `/notes`. Create 2 test note sessions. Hover over a card — trash icon fades in on the right of the meta row. Click it → confirm dialog → click OK → note disappears from grid. Refresh page → still gone. Open one note (`Open` button), click trash on same card — the active panel should close automatically.

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build --webpack`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/notes/page.tsx
git commit -m "feat(notes): add delete button per session with confirm + cascade"
```

---

## Task 6: Wire audio upload in `/notes`

**Files:**
- Modify: `src/app/notes/page.tsx`

- [ ] **Step 1: Add file input ref + upload state**

Inside `NotesPage` near the other refs (around line 83), add:
```tsx
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
```

- [ ] **Step 2: Import `transcribeBlob`**

At line 26 (already imports `onWhisperProgress`), extend:
```tsx
import { onWhisperProgress, transcribeBlob, type WhisperProgress } from "@/lib/voice/whisper";
```

- [ ] **Step 3: Add upload handler**

After `stopCapture` function (around line 178), add:
```tsx
  async function handleUploadAudio(file: File) {
    if (!file) return;
    const MAX_MB = 25;
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorNote(`File too large. Max ${MAX_MB}MB.`);
      return;
    }
    if (!file.type.startsWith("audio/")) {
      setErrorNote("Pick an audio file (m4a, mp3, wav, webm, ogg).");
      return;
    }

    let session = active;
    if (!session) {
      const title = window.prompt("Name this note session", file.name.replace(/\.[^.]+$/, ""));
      if (!title) return;
      const subject = window.prompt("Subject (e.g. Python, Biology, History)", "General") || "General";
      try {
        session = await createNoteSession({ title, subject });
        setActive(session);
        setSessions((cur) => [session!, ...cur]);
      } catch (e) {
        setErrorNote(`Couldn't create session: ${(e as Error).message}`);
        return;
      }
    }

    setUploading(true);
    setErrorNote(null);
    try {
      const text = await transcribeBlob(file);
      if (!text) {
        setErrorNote("No speech detected in the file.");
        return;
      }
      const existing = liveTranscriptRef.current || session.transcript || "";
      const next = (existing + (existing ? "\n\n" : "") + text).trim();
      liveTranscriptRef.current = next;
      setActive((s) => (s ? { ...s, transcript: next } : s));
      if (session.id != null) {
        await updateNoteSession(session.id, { transcript: next });
      }
    } catch (e) {
      setErrorNote(`Transcription failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }
```

- [ ] **Step 4: Wire the hidden input + activate the disabled button**

Find the "Upload audio" disabled button at lines 368-376. Replace:

From:
```tsx
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-2 rounded-2xl bg-surface/70 px-4 py-2.5 text-sm font-medium text-foreground ring-1 ring-white/5 opacity-50"
                    title="Coming soon"
                  >
                    <Headphones size={15} />
                    Upload audio
                  </button>
```

To:
```tsx
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-surface/70 px-4 py-2.5 text-sm font-medium text-foreground ring-1 ring-white/5 hover:bg-surface disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={15} className="animate-spin" /> : <Headphones size={15} />}
                    {uploading ? "Transcribing…" : "Upload audio"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadAudio(f);
                      e.target.value = "";
                    }}
                  />
```

- [ ] **Step 5: Add an Upload audio action inside the ActiveSessionPanel too**

(So users with an open session can upload without going back to the empty-state hero.)

Inside `ActiveSessionPanel`, find the transcript-action button row (around line 580-608). After the `Save` button, add:
```tsx
            <button
              type="button"
              onClick={() => props.onUpload?.()}
              disabled={props.uploading}
              className="inline-flex items-center gap-2 rounded-2xl bg-surface/70 px-4 py-2.5 text-sm font-medium text-foreground ring-1 ring-white/5 hover:bg-surface disabled:opacity-50"
            >
              {props.uploading ? <Loader2 size={15} className="animate-spin" /> : <Headphones size={15} />}
              {props.uploading ? "Transcribing…" : "Upload audio"}
            </button>
```

Extend the `ActiveSessionPanel` props type (around line 503-520) with:
```tsx
  onUpload?: () => void;
  uploading?: boolean;
```

Pass them in from the caller (around line 318-341):
```tsx
            onUpload={() => fileInputRef.current?.click()}
            uploading={uploading}
```

- [ ] **Step 6: Verify in browser**

In Chrome, navigate to `/notes`. Without an active session, click "Upload audio" — prompts for title/subject, then opens picker. Pick any small .m4a / .mp3 / .wav (record one yourself with phone if needed). Whisper download bar appears, then "Transcribing…", then transcript fills the panel. Run Summarize — should work.

With an active session open, the upload button inside the panel should append text to the existing transcript instead of replacing.

- [ ] **Step 7: Lint + build**

Run: `npm run lint && npm run build --webpack`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/app/notes/page.tsx
git commit -m "feat(notes): wire audio upload via Whisper transcription"
```

---

## Task 7: Sidebar collapse toggle

**Files:**
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Add ChevronsLeft + ChevronsRight imports**

In `src/components/AppShell.tsx` lucide imports, add `ChevronsLeft` and `ChevronsRight` (keep alphabetical):
```tsx
import {
  Book,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Home,
  LogOut,
  MessageSquare,
  Mic,
  Settings,
  Sparkles,
} from "lucide-react";
```

- [ ] **Step 2: Add `useState` to React imports**

Replace line 4:
```tsx
import { useEffect, useState } from "react";
```

- [ ] **Step 3: Add a hook for collapsed state with localStorage persistence**

Add this above `AppShell` (e.g., after `useAuthGuard`, around line 237):
```tsx
const COLLAPSE_KEY = "lm:sidebar-collapsed";

function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(COLLAPSE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      // ignore — strict privacy mode
    }
  }, []);

  function set(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  return [collapsed, set];
}
```

- [ ] **Step 4: Modify `SidebarItem` to accept a `collapsed` prop**

Replace the existing `SidebarItem` (lines 44-86) with:

```tsx
function SidebarItem({
  href,
  label,
  icon: Icon,
  collapsed,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  collapsed: boolean;
}) {
  const pathname = usePathname() ?? "";
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={
        "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition " +
        (active
          ? "bg-surface2/80 text-foreground ring-1 ring-white/10 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]"
          : "text-muted hover:bg-surface/50 hover:text-foreground ring-1 ring-transparent") +
        (collapsed ? " justify-center px-2" : "")
      }
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-6 w-1 -translate-x-2 -translate-y-1/2 rounded-r-full bg-teal"
        />
      )}
      <span
        className={
          "inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-white/5 transition " +
          (active
            ? "bg-black/30 text-teal"
            : "bg-black/15 text-foreground/80 group-hover:bg-black/25")
        }
      >
        <Icon size={18} />
      </span>
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
```

- [ ] **Step 5: Apply `collapsed` to the sidebar `<aside>` + header + nav map**

In `AppShell` body, change the `<aside>` block (around line 261-298) to:

```tsx
      <aside
        className={
          "relative z-10 hidden shrink-0 flex-col border-r border-white/5 bg-surface/30 p-5 backdrop-blur-xl transition-[width] duration-200 ease-out lg:flex " +
          (collapsed ? "w-[84px]" : "w-[270px]")
        }
      >
        <Link
          href="/home"
          title={collapsed ? "LearnMate" : undefined}
          className={
            "flex items-center gap-3 rounded-2xl px-2 py-2 " +
            (collapsed ? "justify-center" : "")
          }
        >
          <MascotMini />
          {!collapsed && (
            <div>
              <div className="text-sm font-semibold tracking-tight">LearnMate</div>
              <div className="text-[11px] text-muted">Study companion</div>
            </div>
          )}
        </Link>

        {!collapsed && (
          <div className="mt-7 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Workspace
          </div>
        )}
        <div className={"flex flex-col gap-1 " + (collapsed ? "mt-7" : "mt-2")}>
          {nav.map((item) => (
            <SidebarItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
            />
          ))}
        </div>

        <div className="mt-auto pt-6">
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
            className="mb-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-2xl bg-surface/55 text-xs font-semibold text-muted ring-1 ring-white/5 hover:bg-surface hover:text-foreground"
          >
            {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
            {!collapsed && <span>Collapse</span>}
          </button>
          <UserMenu compact={collapsed} />
        </div>
      </aside>
```

Note: when `collapsed`, `UserMenu compact` is the avatar-only chip you already have (lines 137-177 — it's the same compact variant used in the topbar). Good — no extra work.

- [ ] **Step 6: Call the hook at the top of `AppShell`**

Inside `AppShell` (the exported one, around line 238-243), add right after `const { ready, user } = useAuthGuard();`:

```tsx
  const [collapsed, setCollapsed] = useSidebarCollapsed();
```

- [ ] **Step 7: Verify in browser**

Reload `/home` on desktop. Sidebar shows full width with the new Collapse button at the bottom. Click it → sidebar slides to 84px showing only icons + MascotMini + avatar chip. Hover an icon → tooltip shows the label. Reload page → collapsed state persists. Click expand chevron → back to 270px.

Mobile (DevTools device toolbar): sidebar still hidden under `lg:flex`. Bottom nav unchanged.

- [ ] **Step 8: Lint + build**

Run: `npm run lint && npm run build --webpack`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat(shell): add sidebar collapse toggle with localStorage persistence"
```

---

## Task 8: Apply mascot as favicon

**Files:**
- Create: `src/app/icon.png`

The sidebar already uses `MascotMini`. Login and welcome already use `Mascot`. The only missing placement is the browser tab favicon.

- [ ] **Step 1: Verify Next 16 file convention**

Read `node_modules/next/dist/docs/...` for the `icon` file convention. Per the build plan note in `learnmate/AGENTS.md`, Next 16 has breaking changes — confirm `app/icon.png` is still the convention. Expected: yes, `app/icon.png` (or `icon.{ico,jpg,jpeg,png,svg}`) is auto-served at `/favicon.ico`.

Quick read: `Get-Content node_modules/next/dist/docs/app/api-reference/file-conventions/metadata/app-icons.md` (or wherever it lands — use Glob if path differs).

- [ ] **Step 2: Extend `scripts/gen-icons.mjs` to also emit `src/app/icon.png`**

Existing script (verified) uses `HERE`, `ROOT`, `SRC`, `OUT` constants and a `makeIcon(size, name)` helper that writes into `OUT` (which is `public/icons`). For the Next file-convention icon, we need a different output path, so add a new helper and call after the existing 3 calls.

In `scripts/gen-icons.mjs`, replace the bottom block:

From:
```javascript
await mkdir(OUT, { recursive: true });
await makeIcon(192, "icon-192.png");
await makeIcon(512, "icon-512.png");
await makeIcon(512, "icon-maskable-512.png", { maskable: true });
console.log("done");
```

To:
```javascript
async function makeAppIcon(size, outPath) {
  const mascot = await sharp(await readFile(SRC))
    .resize({
      width: Math.round(size * 0.78),
      height: Math.round(size * 0.78),
      fit: "inside",
    })
    .toBuffer();

  const canvas = sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  });

  const out = await canvas
    .composite([{ input: mascot, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(outPath, out);
  console.log("wrote", outPath, `${out.length} bytes`);
}

await mkdir(OUT, { recursive: true });
await makeIcon(192, "icon-192.png");
await makeIcon(512, "icon-512.png");
await makeIcon(512, "icon-maskable-512.png", { maskable: true });
await makeAppIcon(512, join(ROOT, "src", "app", "icon.png"));
console.log("done");
```

- [ ] **Step 3: Run the generator**

Run: `node scripts/gen-icons.mjs`
Expected: file `src/app/icon.png` exists, ~5-30KB. Open it once to confirm the mascot is visible (not blank).

- [ ] **Step 4: Verify in browser**

Hard-reload `/home` (Ctrl+Shift+R). Browser tab favicon should now be the mascot. View `view-source:` and search for `<link rel="icon">` — Next should have injected it automatically.

- [ ] **Step 5: Update `.gitignore` if needed**

Check `.gitignore` — `src/app/icon.png` is a generated asset. If you want it generated at build time only, add `src/app/icon.png` to `.gitignore` AND add `node scripts/gen-icons.mjs` to a `prebuild` script in `package.json`:
```json
"scripts": {
  "prebuild": "node scripts/gen-icons.mjs",
  ...
}
```

Alternative (simpler): commit `src/app/icon.png` directly. Pick one. **Recommended:** commit it — it's small, deterministic, and avoids breaking deploys if the script ever fails.

- [ ] **Step 6: Lint + build**

Run: `npm run lint && npm run build --webpack`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/icon.png scripts/gen-icons.mjs
git commit -m "feat(branding): add mascot favicon via Next icon file convention"
```

---

## Task 9: Voice mode root-cause fix

**Files:**
- Modify: `src/lib/voice/recognition.ts` (likely)
- Modify: `src/lib/voice/whisper.ts` (likely)
- Modify: `src/app/notes/page.tsx` AND/OR `src/app/talk/page.tsx` (only if both share the bug)

The exact edits depend on the root cause documented in Task 1. Below are the three most likely fixes — apply the one(s) that match your investigation.

- [ ] **Step 1: Fix double-fire of `onEngineChange` in auto-swap**

If Task 1 confirmed engine-pill flicker:

In `src/lib/voice/recognition.ts`, replace lines 285-322 (the auto-mode block) with:

```typescript
  // "auto" with web-speech available: wrap to detect network error and swap.
  let active: RecognitionController;
  let swapped = false;
  let engineAnnounced = false;

  function announce(engine: "web-speech" | "whisper") {
    if (engineAnnounced) return;
    engineAnnounced = true;
    opts.onEngineChange?.(engine);
  }

  const wrappedHandlers: RecognitionOptions = {
    ...opts,
    onError: (code) => {
      if (!swapped && code === "network") {
        swapped = true;
        engineAnnounced = false; // reset so whisper can announce
        announce("whisper");
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
    if (!swapped) announce("web-speech");
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
```

- [ ] **Step 2: Fix Whisper download progress never reaching "ready"**

If Task 1 confirmed progress stalls at 99% or never emits ready:

In `src/lib/voice/whisper.ts:47-67`, add a `done` branch:

```typescript
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
```

- [ ] **Step 3: Fix sticky engine preference blocking Brave fallback**

If Task 1 confirmed Brave never tries Whisper because `loadPreferredEngine()` returns a stale `"web-speech"`:

In `src/lib/voice/engine.ts`, change `loadPreferredEngine` default from returning `"auto"` only when no value is stored, to ALSO returning `"auto"` when the stored value is `"web-speech"` but Web Speech is now blocked. Simpler fix: just return `"auto"` always. The auto path is robust enough.

Replace `src/lib/voice/engine.ts:9-18`:
```typescript
export function loadPreferredEngine(): EngineChoice {
  // Always start in auto mode. The wrapper will swap to whisper transparently
  // on network errors. Storing "web-speech" as a sticky preference causes
  // Brave/Arc users to retry the broken path on every page load.
  return "auto";
}
```

`rememberEngine` and `clearEnginePreference` can stay (they're harmless if unused) or be deleted along with their call sites in `/notes` and `/talk` pages. **Recommended:** delete the calls + functions for YAGNI.

If deleted:
- Remove `rememberEngine` import + call in `src/app/notes/page.tsx` (line 25 + 165).
- Remove `rememberEngine` import + call in `src/app/talk/page.tsx` (line 21 + corresponding call site).

- [ ] **Step 4: Verify in Chrome AND Brave**

Reload `/notes` in both. Reload `/talk` in both. Record an utterance. Engine pill should show Cloud in Chrome and swap-to-Local-Whisper in Brave on first attempt. No flicker. Whisper progress reaches "ready" cleanly.

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build --webpack`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/voice/recognition.ts src/lib/voice/whisper.ts src/lib/voice/engine.ts src/app/notes/page.tsx src/app/talk/page.tsx
git commit -m "fix(voice): resolve engine-swap flicker, stuck Whisper progress, sticky preference per QA"
```

---

## Task 10: Quiz fallback chain hardening

**Files:**
- Modify: `src/lib/ai/models.ts`
- Modify: `src/app/api/ai/quiz/route.ts`
- Modify: `src/app/quiz/page.tsx`

- [ ] **Step 1: Update quiz fallback chain**

In `src/lib/ai/models.ts`, replace the `quiz` block (lines 37-44) with the new order from Task 2 investigation. Example (verify each ID exists on OpenRouter free tier first — substitute IDs that 200'd in your curl test):

```typescript
  quiz: {
    primary: "qwen/qwen3-next-80b-a3b-instruct:free",
    fallbacks: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "openai/gpt-oss-120b:free",
      "google/gemma-4-31b-it:free",
      "deepseek/deepseek-v4-flash:free",
      "openrouter/free",
    ],
  },
```

**Hard requirement — every ID must end in `:free` or `openrouter/free`.** The `assertFree` guard at `src/lib/ai/models.ts:9-16` will throw at runtime if any other ID slips in. Do NOT bypass it.

- [ ] **Step 2: Surface `chain_exhausted` from the route**

In `src/app/api/ai/quiz/route.ts`, replace the catch block (lines 84-103) with:

```typescript
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
          status: err.status,
        },
        { status },
      );
    }
    return Response.json(
      { error: "unknown", message: (err as Error).message },
      { status: 500 },
    );
  }
```

- [ ] **Step 3: Extend ErrorState union + map server response**

In `src/app/quiz/page.tsx` at lines 11-15, replace:

```tsx
type ErrorState =
  | { kind: "none" }
  | { kind: "rate_limited" }
  | { kind: "missing_key" }
  | { kind: "generic"; message: string };
```

With:
```tsx
type ErrorState =
  | { kind: "none" }
  | { kind: "rate_limited" }
  | { kind: "missing_key" }
  | { kind: "chain_exhausted"; lastModel?: string }
  | { kind: "generic"; message: string };
```

In the `generate` function around line 70-80, replace the `kind` mapping:

From:
```tsx
        const kind: ErrorState["kind"] =
          payload.error === "rate_limited" || res.status === 429
            ? "rate_limited"
            : payload.error === "missing_key" || res.status === 503
              ? "missing_key"
              : "generic";
        setError(
          kind === "generic"
            ? { kind, message: payload.message ?? `Error ${res.status}` }
            : { kind },
        );
```

To:
```tsx
        if (payload.error === "chain_exhausted") {
          setError({ kind: "chain_exhausted" });
        } else if (payload.error === "rate_limited" || res.status === 429) {
          setError({ kind: "rate_limited" });
        } else if (payload.error === "missing_key" || res.status === 503) {
          setError({ kind: "missing_key" });
        } else {
          setError({ kind: "generic", message: payload.message ?? `Error ${res.status}` });
        }
```

- [ ] **Step 3b: Render chain_exhausted with retry**

Find the existing error rendering block in the `<AppShell>` body (search for `error.kind === "rate_limited"`). Add a parallel branch immediately after:

```tsx
{error.kind === "chain_exhausted" && (
  <div className="rounded-2xl bg-red/15 px-3 py-2.5 text-xs text-foreground ring-1 ring-red/30">
    <strong>All free models are busy.</strong>{" "}
    <span className="text-muted">Wait ~30 seconds and try again.</span>
    <button
      type="button"
      onClick={() => generate(topic)}
      className="ml-2 rounded-xl bg-bg/45 px-2 py-1 text-[11px] font-semibold ring-1 ring-white/5 hover:bg-bg/65"
    >
      Try again
    </button>
  </div>
)}
```

- [ ] **Step 4: Verify in browser**

Generate a quiz under normal conditions — succeeds. Force chain exhaustion: temporarily set `OPENROUTER_API_KEY` to an invalid key in `.env.local`, restart server, generate. UI should now say "All free models are busy" with a Try Again button. Restore the real key. Restart. Generate again — works.

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build --webpack`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/models.ts src/app/api/ai/quiz/route.ts src/app/quiz/page.tsx
git commit -m "fix(quiz): reorder free fallback chain + surface chain_exhausted with retry"
```

---

## Task 11: Final QA pass + verification-before-completion

**Files:** None modified.

- [ ] **Step 1: Invoke `superpowers:verification-before-completion` skill**

This is mandatory before declaring done. Run lint + build one final time:
```bash
npm run lint
npm run build --webpack
```
Both must end clean.

- [ ] **Step 2: Full manual checklist (from spec §Testing checklist)**

Walk every line in `docs/superpowers/specs/2026-05-21-qa-punchlist-design.md` under "Testing checklist". Tick each one with browser observation.

- [ ] **Step 3: Cross-browser pass**

Test in Chrome AND Brave (and Edge if available):
- Voice in `/notes` works.
- Voice in `/talk` works.
- Audio upload in `/notes` works.
- Quiz generation works.

- [ ] **Step 4: Update memory**

Update `project_learnmate_state.md` in `C:\Users\jihad\.claude\projects\C--Users-jihad-desktop-appdev\memory\` to reflect:
- QA punch-list shipped 2026-05-21.
- Voice bugs fixed (note the root cause).
- Quiz chain hardened.
- Notification + search removed.
- Sidebar collapse + favicon shipped.

- [ ] **Step 5: Final commit (memory + any docs touched)**

```bash
git add -A
git commit -m "chore: QA punch-list complete — voice, quiz, shell, branding"
```

---

## Spec coverage check (writer's self-review)

Spec items vs. plan tasks:

| Spec item | Task |
|---|---|
| 1. Voice mode bug | 1, 9 |
| 2. Recording bugs | 1, 9 |
| 3. Audio upload | 6 |
| 4. Delete note | 4, 5 |
| 5. Remove bell | 3 |
| 6. Remove search | 3 |
| 7. Sidebar collapse | 7 |
| 8. Mascot logo (favicon piece only — sidebar/login/welcome already done) | 8 |
| 9. Quiz dies | 2, 10 |

All covered. Final pass in Task 11.
