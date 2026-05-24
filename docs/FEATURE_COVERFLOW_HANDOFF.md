# Handoff: replace the Features grid with a scroll-pinned 3D coverflow (for Claude Code)

**Goal:** Replace the current `Features` section in `learnmate/src/app/_landing/LandingPage.tsx` with a **Cleo-style scroll-pinned 3D coverflow** of the same six feature cards, **plus** a cursor **spotlight** border and a **magnetic tilt** on the focused (center) card.

**Source of truth for layout, math, palette, timings:** the working prototype `learnmate/docs/feature_coverflow_preview.html`. Open it, scroll it, and mirror its behavior. The notes below restate its exact constants so you don't have to reverse-engineer.

**Hard scope:** Only touch the `Features` area. Do **not** change the hero (3D buddy → phone → chat reveal) or any section below Features (VoiceShowcase, HowItWorks, screens, value/CTA, footer). Keep the section's `id="features"` and the existing heading block (eyebrow "Six tools, one buddy" + the `lm-text-grad` / italic-teal `<h2>` + muted `<p>`) exactly as they are. Only the **card grid** under that heading becomes the coverflow.

---

## What to reuse (already in the file — don't re-create)
- The six feature definitions (tone, icon, title, body, preview) currently passed to `<FeatureCard>` in `Features()`.
- The preview widgets: `TalkPreview`, `ChatPreview`, `NotesPreview`, `QuizPreview`, `ResearchPreview`, `PrivacyPreview`.
- `ToneSwatch`, the `FeatureTone` type, the lucide icons (`Mic, MessageSquare, BookOpen, Sparkles, FileText, Lock, ArrowUpRight`), and the `Reveal` component.
- The CSS tokens in `globals.css`: `--bg #0b0f0e`, `--surface #15191a`, `--surface2 #1e2422`, `--teal #34e0c4`, `--lime #c8f65d`, `--purple #c9a7f5`, `--pink #f7b8d2`, `--blue #3b6fe0`, `--green`, `--red`, mint `#7AE3CC`, 28px radius, Poppins via `--font-brand`.

Lift the six items into a single `FEATURES` array (so the coverflow and the reduced-motion fallback render from one source):
```ts
const FEATURES = [
  { tone:"lime",   icon:<Mic size={19}/>,          title:"Talk with Bot",      body:"Press once. Talk. Hear it back. Real-time speech in, real-time voice out — the way you study with a friend, except this one never gets tired.", Preview: TalkPreview },
  { tone:"purple", icon:<MessageSquare size={19}/>,title:"Chat with Bot",      body:"Streamed answers, code-aware, full history. Pin a chat to keep grinding the same topic.", Preview: ChatPreview },
  { tone:"teal",   icon:<BookOpen size={19}/>,     title:"Take Notes",         body:"Speak. We transcribe. Then summarize, rewrite, or turn it into a quiz with one tap.", Preview: NotesPreview },
  { tone:"pink",   icon:<Sparkles size={19}/>,     title:"Quiz with Bot",      body:"Five sharp MCQs from any note or topic. Tap or speak your answer. Instant feedback + rationale.", Preview: QuizPreview },
  { tone:"blue",   icon:<FileText size={19}/>,     title:"Research Assistant", body:"Paste, upload, or scan a paper. Get a quality score, inline edits, and grammar fixes you can accept one at a time.", Preview: ResearchPreview },
  { tone:"mint",   icon:<Lock size={19}/>,         title:"Local & Private",    body:"No login required. Notes, quizzes, and chats live in your browser — close the tab, it stays yours.", Preview: PrivacyPreview },
] as const;
```

---

## Interaction spec (mirror the prototype exactly)

**Layout:** a tall pinned section. The outer `<section>` is the scroll runway; an inner wrapper is `position: sticky; top: 0; height: 100vh; overflow: hidden`. Inside it: a background glow, the centered stage (`perspective: 1500px`), the small label, and progress dots.

**Cards** are absolutely positioned at `left:50%; top:50%`. Drive everything from a single float `focus ∈ [0, n-1]` computed from scroll progress:
```
total    = section.offsetHeight - window.innerHeight
scrolled = clamp(-section.getBoundingClientRect().top, 0, total)
p        = total > 0 ? scrolled / total : 0      // 0..1
focus    = p * (n - 1)
```
For each card index `i`, with `o = i - focus`, `ao = Math.abs(o)`:
```
x       = o * SPACING
rotateY = clamp(-o * 26, -44, 44) deg
z       = -ao * 150 px
scale   = max(0.74, 1 - ao*0.12)
opacity = max(0.14, 1 - ao*0.42)
zIndex  = 100 - round(ao*10)
transform = translate(-50%,-50%) translateX(x) translateZ(z) rotateY(rotateY) scale(scale)
isFocus = ao < 0.5      // toggles spotlight + enables magnetic tilt
```
**SPACING (responsive):** `Math.min(360, Math.max(210, window.innerWidth * 0.34))`.
**Scroll runway height:** set the outer section to `${n*55 + 60}vh` (≈ 390vh for 6 cards — one screen of travel per card). This is the main "speed" knob; expose it as a constant.

**Spotlight (focused card):** on the card's inner element, `pointermove` sets CSS vars `--mx/--my` (cursor position). Two pseudo-elements use them: an inner radial white highlight, and a masked radial **teal border trace**. Only visible when the card has `is-focus`.

**Magnetic tilt (focused card only):** in the same `pointermove`, when `is-focus`, set the inner element's transform to `rotateY(px*8deg) rotateX(-py*8deg)` where `px=(x-rect.left)/w-0.5`, `py=(y-rect.top)/h-0.5`. Reset on `pointerleave`. (Outer card holds the coverflow transform; inner holds the tilt — keep them on **separate** elements so they don't fight.)

**Dots:** one per card; the one matching `Math.round(focus)` is active (teal, widened).

**Background glow:** centered radial `teal ~22%` + `lime ~12%`, gentle opacity breathe.

---

## React implementation notes (important)
- This needs client-side scroll + pointer handlers. Confirm the file has `"use client"` at the top (the hero/Reveal already require it). If for some reason it doesn't, extract the coverflow into a new `"use client"` component `_landing/FeatureCoverflow.tsx` and import it — but reuse the preview components (export them from `LandingPage.tsx` or move them + `ToneSwatch` into a small shared module so both files share one copy).
- **Do not drive per-frame transforms through React state.** Keep an array of card refs and write `el.style.transform` / `opacity` / `zIndex` directly inside a `requestAnimationFrame` loop fed by a passive `scroll` listener (rAF-throttle: only recompute on the next frame after a scroll/resize). Use refs, not re-renders.
- `useEffect`: set up `scroll` + `resize` listeners and the initial layout; **return a cleanup** that removes them and cancels any pending rAF.
- Guard everything behind `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. When reduced motion is on (or before hydration / SSR), render the **existing bento grid** (`grid gap-4 md:grid-cols-3` of `<FeatureCard>`, Talk card `size="lg"`) as the fallback — that's already in the repo, so the page is always correct and accessible. Decide reduced-motion in an effect to avoid hydration mismatch (render the grid on the server, swap to coverflow on the client when motion is allowed).
- Make the focused card's inner the only keyboard/hover-interactive target; side cards should be `pointer-events: none` or visually inert so the spotlight doesn't trigger on them.

## CSS (add to `globals.css`, matching the existing `lm-*` pattern)
Add scoped classes — these handle the bits Tailwind can't (the masked gradient border + cursor-var spotlight). Keep the dynamic transforms inline via refs.
```css
.cf-card{ position:absolute; left:50%; top:50%; width:330px; height:430px; transform-style:preserve-3d; will-change:transform,opacity; transition:opacity .25s; }
@media (max-width:760px){ .cf-card{ width:248px; height:360px; } }
.cf-inner{ position:relative; width:100%; height:100%; border-radius:28px; background:color-mix(in oklab,var(--surface) 78%,transparent); border:1px solid rgba(255,255,255,.08); padding:22px; overflow:hidden; transition:transform .12s ease-out, box-shadow .3s; box-shadow:0 40px 80px -34px rgba(0,0,0,.9); transform-style:preserve-3d; }
.cf-inner .cf-glow{ position:absolute; right:-50px; top:-50px; width:190px; height:190px; border-radius:999px; filter:blur(52px); opacity:.34; transition:opacity .35s; }
.cf-inner::before{ content:""; position:absolute; inset:0; border-radius:inherit; opacity:0; transition:opacity .3s; pointer-events:none; background:radial-gradient(240px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,.10), transparent 60%); }
.cf-inner::after{ content:""; position:absolute; inset:0; border-radius:inherit; padding:1px; pointer-events:none; opacity:0; transition:opacity .3s; background:radial-gradient(280px circle at var(--mx,50%) var(--my,50%), color-mix(in oklab,var(--teal) 85%,transparent), transparent 65%); -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; }
.cf-card.is-focus .cf-inner{ border-color:rgba(255,255,255,.16); }
.cf-card.is-focus .cf-inner::before, .cf-card.is-focus .cf-inner::after{ opacity:1; }
.cf-card.is-focus .cf-inner .cf-glow{ opacity:.6; }
```
(Inside the inner card, give the icon `transform:translateZ(40px)`, the title `translateZ(26px)`, and the preview `translateZ(18px)` so they float on tilt — see prototype.)

---

## Tech, build, verify
- Branch off main (e.g. `feat/features-coverflow`). No new dependencies needed (pure React + CSS).
- `cd learnmate` → `npm run build --webpack` must succeed with **no console errors**.
- `npm run dev` (port 4444) and check: desktop scroll plays the coverflow smoothly; mobile shrinks cards/spacing; with OS "reduce motion" on, the static bento grid renders instead.
- Keep TypeScript strict — type the refs (`HTMLDivElement[]`) and the `FeatureTone` union; no `any`.

## Acceptance
- The `Features` heading block is unchanged; below it, scrolling pins the section and the six cards arc through a 3D track (center faces viewer, neighbors angle away + dim).
- The centered card shows the teal spotlight border + cursor highlight and tilts toward the mouse; side cards stay calm.
- Progress dots track the active card.
- `prefers-reduced-motion` → the existing grid fallback; no hydration warnings.
- Hero and every section below Features are byte-for-byte unchanged.
- `npm run build --webpack` passes; no runtime/console errors on desktop or mobile.

## Tunables (leave as top-of-component constants so they're easy to adjust)
- `RUNWAY_VH = n*55 + 60` (scroll length / speed)
- `SPACING` formula above (how many neighbors peek in)
- `MAX_ROTATE = 44`, `ROTATE_PER = 26`, `DEPTH = 150`, `TILT = 8`

---

## ALSO FIX (same branch): mobile horizontal overflow + clipped text on the Home dashboard

On a phone, the Home screen (`src/app/home/page.tsx`, inside `AppShell`) clips the **right edge** of the content: the right-column action cards (Chat with Bot / Quiz with Bot), the "Quick actions" row, and the suggestion cards (e.g. "Open notes library") all get cut off, and the text feels cramped. The page content column is rendering **wider than the viewport** and the root's `overflow-x-hidden` is hiding (not fixing) the spillover. Repro at 320–430px width.

**Already verified NOT the cause (don't re-fix these):**
- `AppShell` root is `flex min-h-dvh w-full overflow-x-hidden`; `<main>` already has correct horizontal padding (`px-4 sm:px-5 lg:px-8`) and the bottom-nav clearance (`pb-[calc(8.5rem+env(safe-area-inset-bottom))]`).
- The page content is wrapped in `mx-auto w-full max-w-[1180px]`.
- The `.lm-aurora` background layer is `fixed inset-0` (pure radial gradients) — not an overflow source.
- The stats / suggestions grids use `grid-cols-2 md:grid-cols-4` with `min-w-0` + `truncate` children.

**Prime suspects to check first:**
1. **`src/components/ActionCard.tsx` fixed heights.** Cards are hard-pinned to `h-[260px]` (large) and `h-[120px]` (compact) with `p-5`, an **absolutely-positioned** icon (`absolute right-4 top-4`) and badge (`absolute bottom-4 left-4`). On small phones this both crowds the text and can let a longer/wrapped title collide with the badge. Prefer `min-h-[…]` over fixed `h-[…]` so the card grows with its content, and make sure the title block has bottom padding that clears the absolute badge (e.g. reserve space with `pb-12` instead of relying on the fixed height). Confirm the title (`whitespace-pre-line` "Talk\nwith Bot") and `description` (`max-w-[22ch]`) never overflow at 320px.
2. **The action grid in `home/page.tsx` (lines ~129–159).** `grid grid-cols-2 gap-4` with a nested `grid grid-rows-2 gap-4` in the right column. Add `min-w-0` to the grid **and** to each grid child (the `<Link className="block">` wrappers and the nested grid `<div>`), so a child's intrinsic content can't force a track wider than `1fr`. (Tailwind's `grid-cols-2` is `minmax(0,1fr)`, but the nested grid + `block` links are the likely spillover.)
3. **Find the exact offending node at runtime** rather than guessing. With `npm run dev` (port 4444), open the Home page at ~390px and paste this in the console to highlight anything wider than the viewport:
   ```js
   document.querySelectorAll('*').forEach(el=>{ if(el.getBoundingClientRect().right > document.documentElement.clientWidth + 1) el.style.outline='2px solid red'; });
   ```
   Fix the outlined element(s) — typically by adding `min-w-0`, removing a fixed width/height, allowing wrap/`truncate`, or reducing mobile padding.

**Acceptance for this fix:**
- No horizontal scrolling or right-edge clipping on Home at 320 / 360 / 390 / 414px widths; both action-card columns and all "Quick actions" tiles are fully visible with even left/right gutters.
- Card text (titles, descriptions, badges) never overlaps or gets cut; cards grow to fit their content instead of clipping it.
- Tablet/desktop layout (`md`/`lg`) is unchanged; `npm run build --webpack` still passes with no console errors.

---

## Common pitfalls (seen in the first build — avoid)
- **Card spacing must scale with the card width.** Cards are `min(86vw, 340px)` wide, so the per-card horizontal offset (`STEP`) must be roughly `cardW * 0.7–0.86` (≈ 240–290px on desktop) — NOT a small fixed value like `130px`. Too small and the cards overlap into an unreadable pile. Use: `const cardW = Math.min(window.innerWidth*0.86, 340); const STEP = Math.round(cardW * (isSm ? 0.7 : 0.86));`
- **Card backgrounds must be opaque** (e.g. `bg-surface`, not `bg-surface/85`, and drop `backdrop-blur`) so that during scroll transitions the front card fully occludes the cards behind it instead of letting their text bleed through.
- **Dim distant cards faster:** `opacity = Math.max(0, 1 - abs * 0.55)`.
