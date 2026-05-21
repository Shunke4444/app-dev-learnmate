# QA Punch-List — Design Spec

**Date:** 2026-05-21
**Project:** LearnMate
**Source:** QA team feedback (post-UI-redesign milestone)
**Author:** Claude (paired with Vijay)

## Goal

Address the 9 issues raised by the QA team in a single bundled pass, without expanding scope into Supabase wire-up, multi-language UI, or any visual redesign work.

## Items

1. **Voice mode "Google" bug** — voice recognition still has issues; verify Whisper fallback works and fix root cause.
2. **Recording bugs (intermittent)** — note recording in `/notes` works "okay naman" but bugs out sometimes; trace alongside #1.
3. **Audio upload** — `Upload audio` button in `/notes` is currently a disabled placeholder; wire it up.
4. **Delete note** — no way to delete a saved note session; add destructive action.
5. **Remove notification bell** — `Bell` icon in topbar has no backing system; strip it.
6. **Remove search bar** — topbar search input is non-functional; strip it.
7. **Sidebar collapse toggle** — add a toggle to shorten the sidebar (icons-only mode) so the main content gets more room.
8. **Mascot as logo** — apply `public/mascot/idle.png` as favicon + sidebar header + login + welcome hero.
9. **Quiz generation dies sometimes** — `/quiz` occasionally fails outright; harden fallback chain. **All models must be free on OpenRouter (`:free` suffix). No paid models, ever.**

## Out of scope

- Multi-language UI — English-only confirmed.
- Real notification system — removed entirely, not deferred.
- Supabase wire-up.
- Any non-collapse changes to sidebar.

## Architecture & file map

| File | Change |
|---|---|
| `src/components/AppShell.tsx` | Remove `Bell` icon button + entire search input block (lines ~268–280). Remove unused `Search` import. Add chevron collapse toggle. Replace sidebar header "LearnMate" text with `<Image src="/mascot/idle.png" />` + wordmark. Persist `lm:sidebar-collapsed` in `localStorage`. Tooltips on icons when collapsed (`title=`). |
| `src/app/notes/page.tsx` | Replace disabled `Upload audio` button with active file input. Add per-card `Trash` button (visible on hover). Wire delete confirm + call to `deleteNoteSession`. Close active panel if it was the one deleted. |
| `src/lib/db/dexie.ts` | Add `deleteNoteSession(id: number): Promise<void>` that also clears any quizzes/attempts referencing this `sourceNoteId`. |
| `src/lib/voice/recognition.ts` | After investigation (see §"Voice investigation"), apply targeted fix. Likely candidates: stale-controller bug after engine swap; double-fire `onEngineChange`; Whisper download hang surfacing as silent failure. |
| `src/app/talk/page.tsx` | Apply same recording fix if duplicated logic surfaces during investigation. |
| `src/app/login/page.tsx` | Add `<Image src="/mascot/idle.png">` above title block. |
| `src/app/welcome/page.tsx` | Add mascot above hero. |
| `src/app/icon.png` (new) | Copy or convert from `public/mascot/idle.png` — Next 16 auto-serves `app/icon.png` as `/favicon.ico`. Per `node_modules/next/dist/docs/` file-convention docs. |
| `src/lib/ai/models.ts` | Re-order quiz fallback chain (proven models first) + add 1-2 more `:free` entries. **`assertFree()` guard already enforces `:free` suffix — leave intact.** |
| `src/app/api/ai/quiz/route.ts` | Improve error surface: when whole chain exhausts, return clear `chain_exhausted` code with last-model + last-status so UI can show useful copy. |
| `src/app/quiz/page.tsx` | Surface `chain_exhausted` with a "Try again" button. Show which model finally succeeded (already passed via `X-LearnMate-Model` header). |

## Sidebar collapse mechanics

- Default expanded width: 260px. Collapsed: 72px (icon column only).
- State persisted in `localStorage["lm:sidebar-collapsed"]` (`"1"` / `"0"`).
- Toggle button: chevron icon at sidebar bottom (above the user card) or top-right of sidebar.
- Labels hidden when collapsed; icons remain centered. Hover shows `title=` tooltip.
- Bottom user card collapses to avatar-only when sidebar is collapsed.
- CSS transition: `width 200ms ease`. Use Tailwind `transition-[width]` + conditional class.
- Mobile (`<768px`) — sidebar is already off-canvas; collapse toggle hidden in mobile breakpoint.

## Audio upload flow

```
[Upload audio button] → <input type="file" accept="audio/*" hidden>
  ↓ user picks file (m4a / mp3 / wav / webm / ogg)
  ↓ validate ≤ 25MB
  ↓ show progress: "Transcribing… (X% downloaded)" reusing whisper-progress events
  ↓ blob → transcribeBlob(blob) from lib/voice/whisper.ts
  ↓ append result to active session transcript
  ↓ Dexie write
  ↓ user runs Summarize / Rewrite normally
```

Web Speech is **not** used for uploads (mic-realtime only). Whisper handles all uploads regardless of browser. If no active session exists when user clicks Upload, prompt for title + subject first (same flow as `New note`).

## Delete note flow

- `Trash` icon top-right of each card in the Library grid. Opacity 0 → 100 on `group-hover`.
- Click → `window.confirm("Delete '<title>'? This cannot be undone.")` → call `deleteNoteSession(id)` → `refreshSessions()`.
- If `active?.id === deleted.id`, set `active(null)` and stop any in-flight capture.
- `deleteNoteSession` also deletes orphaned quizzes (`quizzes` where `sourceNoteId === id`) and any `quizAttempts` for those quiz ids. Wrapped in a Dexie transaction.

## Voice investigation (item #1, #2)

Before patching, run the app and reproduce. Hypotheses to test in order:

1. **`onerror({error:"network"})` fires but Whisper download never completes** — check `onWhisperProgress` events; if download stalls, fix `lib/voice/whisper.ts` lazy-load.
2. **Stale `rec.current` after engine swap** — the wrapper in `createRecognition` keeps the original ref to `active`, but `recRef.current` in `/notes` + `/talk` page still points to the wrapper. Verify swap really propagates `start()` to the Whisper controller.
3. **`onEngineChange` fires twice on auto-mode** — `queueMicrotask` + later `swapped` path may emit twice; UI shows engine flicker.
4. **`/talk` vs `/notes` divergence** — different error-handling code paths. Pick one and unify.

Fix the root cause that reproduces. Do not blind-patch.

## Quiz fallback hardening (item #9)

Current state (`lib/ai/models.ts:37`):

```
primary: openai/gpt-oss-120b:free
fallbacks: [
  google/gemma-4-31b-it:free,
  qwen/qwen3-next-80b-a3b-instruct:free,
  openrouter/free
]
```

Issues:
- `openai/gpt-oss-120b:free` may be heavily rate-limited (popular free tier).
- JSON-schema strict mode can fail on weaker models → `bad_output` 502.
- When whole chain exhausts, UI shows generic error.

Changes:
1. **Re-order chain** — put proven JSON-strict models first. Candidate primary: `qwen/qwen3-next-80b-a3b-instruct:free` (known good with structured output). Move `gpt-oss-120b` to fallback. Verify against current free catalog at https://openrouter.ai/models?max_price=0 before merging.
2. **Add 1-2 more free models** to deepen the chain (e.g., `meta-llama/llama-3.3-70b-instruct:free`, `deepseek/deepseek-v4-flash:free` — already used in chat chain).
3. **`assertFree` stays untouched** — the `:free` enforcement is the user's hard requirement and the guard already enforces it. Any model added MUST end in `:free` or the guard will throw at runtime.
4. **`openrouter/free` last** — generic free-tier router as final fallback.
5. **`/api/ai/quiz/route.ts`** — when `OpenRouterError` bubbles after chain exhaustion, return JSON `{ error: "chain_exhausted", lastModel, lastStatus, message }` so UI can show specific retry copy.
6. **`/quiz` page** — render "All free models busy. Try again in a moment." with a Try Again button on `chain_exhausted`.

## Mascot logo placement

- **Favicon:** `src/app/icon.png` — Next 16 file-convention. Copy `public/mascot/idle.png` (or down-scale via `scripts/gen-icons.mjs`).
- **Sidebar header:** Replace text-only `LearnMate` block at top of sidebar with `<Image src="/mascot/idle.png" width={28} height={28}>` + wordmark to the right. When collapsed, only mascot shows.
- **Login (`/login`):** Add mascot above title block (40–48px).
- **Welcome (`/welcome`):** Add mascot at top of hero (larger — 64–96px).
- Use `next/image` everywhere. No raw `<img>`.

## Testing checklist

For each item, manually verify in browser before claiming done:

- [ ] Bell + search are gone from topbar (Chrome desktop, mobile breakpoint).
- [ ] Sidebar collapse toggle: expand → collapse → reload → state persists. Tooltips appear on hover when collapsed.
- [ ] Upload audio: pick a .m4a, see progress, transcript appears, Summarize works.
- [ ] Delete note: trash icon appears on hover, confirm prompt fires, note disappears, active panel closes if deleted.
- [ ] Voice recording in `/notes` + `/talk` works in Chrome AND Brave; engine pill matches reality.
- [ ] Quiz: generate 5 questions in Chrome — succeeds within fallback budget. Force chain exhaustion (toggle network) — see specific error UI with retry button.
- [ ] Favicon shows mascot in browser tab; sidebar/login/welcome show mascot.
- [ ] `npm run lint` + `npm run build --webpack` both clean.

## Risk

- **Voice investigation may surface deeper bug** than expected — if root cause is in `@huggingface/transformers` itself, may need to defer item #1 with a clear note.
- **OpenRouter free catalog churn** — model IDs in spec may have been retired since the build plan was last verified (May 2026). Verify at `https://openrouter.ai/models?max_price=0` before merging the models.ts change.
- **Mascot image quality at favicon size (16px / 32px)** — `idle.png` may not legibly down-scale. If it looks muddy, generate a dedicated small-size variant via `scripts/gen-icons.mjs`.
