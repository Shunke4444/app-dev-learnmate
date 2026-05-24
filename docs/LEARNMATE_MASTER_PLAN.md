# LearnMate — Master Plan (single source of truth for Claude Code)

This file is the authoritative checklist for the LearnMate landing + app polish work. If anything ever reverts (e.g. a `/redo`), one Claude Code run should be able to restore the intended state from this file plus the referenced specs.

## Repo facts
- App root: `learnmate/` (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4).
- Landing entry: `learnmate/src/app/_landing/LandingPage.tsx` — renders `<Nav/> <Hero3D/> <Marquee/> <Features/> <VoiceShowcase/> … <FinalCTA/> <Footer/>`.
- Hero component: `learnmate/src/app/_landing/Hero3D.tsx` (Three.js buddy + scroll choreography).
- Design tokens (in `globals.css`): `--bg #0b0f0e`, `--surface #15191a`, `--surface2 #1e2422`, `--teal #34e0c4`, `--lime #c8f65d`, `--purple #c9a7f5`, `--pink #f7b8d2`, `--blue #3b6fe0`, `--green #5bd75b`, `--red #e0584f`, mint `#7AE3CC`, card radius ~24–28px. Font: Poppins via `--font-brand`. Reuse the `Reveal` component for scroll-ins.
- Build/verify: `cd learnmate && npm run build --webpack`; dev on port 4444 (`npm run dev`). Work on a branch.
- Source-of-truth concept files in this folder (`learnmate/docs/`): `landing_preview.html` (hero), `feature_coverflow_preview.html` (feature cards). Detailed prompts: `LANDING_HERO_HANDOFF.md`, `FEATURE_COVERFLOW_HANDOFF.md`.

## IMPORTANT — current verified state (2026‑05‑24)
- **The phone hero is NOT lost.** `Hero3D.tsx` currently contains the full intended hero: Three.js buddy (head + emissive teal eyes) whose head/eyes track the mouse → scroll **zoom-out** → realistic **phone** reveal → phone **turn** (`rotateY -24°`, slight `rotateX`) → screen becomes a **message-by-message chat** → ends at the phone (everything below stays the original production landing). `LandingPage.tsx` renders `<Hero3D/>`.
- If a deployed site or dev preview shows the OLD static hero ("Your study buddy that actually listens" + chips + stats), that is a **stale build / cached deploy**, not the source. Fix by rebuilding and redeploying (`npm run build` → redeploy on Vercel).
- The **green backdrop glow behind the 3D logo** has been added to `Hero3D.tsx` (see item 1).
- The **signup → login mode bug** is fixed (see item 4).

---

## 1. Hero — 3D buddy → phone → chat (KEEP / RESTORE)  ✅ present
**File:** `_landing/Hero3D.tsx`. **Source of truth:** `landing_preview.html` + `LANDING_HERO_HANDOFF.md`.

Behavior to preserve, in order:
1. Full-viewport 3D buddy (dark rounded head, two glowing teal eyes); **head follows the mouse, eyes shift toward the cursor**. Tagline **"Your learning buddy."**
2. On scroll, **zoom out** to reveal the buddy is inside a **realistic phone** (titanium edge, side buttons, dynamic island, status bar, screen reflection).
3. Phone **turns** (`rotateY ~ -24°`) as you keep scrolling.
4. Screen **becomes a chat** revealing message-by-message tied to scroll (ask → reply → quiz → "save as note").
5. **Stop at the phone** — everything below the hero is the original production landing (Marquee, Features, VoiceShowcase, …). Do not add a new value section; the Features section already carries "Everything you need to study, nothing you'd pay for."

Hard requirements (already satisfied in the file — keep them): WebGL init is `try/catch`-guarded and falls back to the static `/AI.png` mascot; canvas sized from `window.innerWidth/Height`; buddy stays visible through the zoom and fades out exactly as the chat fades in; `prefers-reduced-motion` disables the 3D/scroll transforms; Poppins + tokens; only the hero is affected.

**NEW — green backdrop glow behind the 3D logo (added):** a soft teal→lime radial halo sits *inside the buddy/stage layer*, rendered **before** the WebGL canvas so the buddy renders on top and the halo shows through the transparent canvas around it; it scales and fades with the buddy as you scroll into the phone. Current implementation (in the stage `div`):
```jsx
<div
  className="absolute left-1/2 top-1/2 h-[58vmin] w-[72vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
  style={{
    background:
      "radial-gradient(closest-side, rgba(52,224,196,0.36), rgba(52,224,196,0.15) 46%, rgba(200,246,93,0.07) 66%, transparent 78%)",
    filter: "blur(10px)",
  }}
/>
```
**No first-paint flash (fixed):** on load there was a split-second flash of the un-zoomed phone + buddy before the scroll script positioned things. Fix applied — the sticky hero is gated invisible (`opacity-0`) until the first positioning `frame()` runs, then fades in (`transition-opacity duration-200`) via a `ready` state set immediately after that first `frame()`. `setReady(true)` runs unconditionally (even if a ref is momentarily null), so the hero can never get stuck invisible.

**Acceptance:** buddy's eyes follow the mouse on a WebGL browser (static `/AI.png` otherwise); a green halo glows behind the logo at the top and recedes/fades with the buddy as the phone is revealed; zoom → phone reveal → turn → chat is smooth on desktop and mobile; **no un-zoomed flash on initial render**; reduced-motion shows a static hero + chat; no console errors.

## 2. Features — scroll-pinned 3D coverflow + spotlight + magnetic  ⏳ to build
**File:** replace the card grid in `Features()` in `LandingPage.tsx`. **Full spec:** `FEATURE_COVERFLOW_HANDOFF.md`. **Visual reference:** `feature_coverflow_preview.html`.

Summary: a Cleo-style scroll-pinned 3D coverflow of the six existing feature cards (center faces viewer, neighbors `rotateY` away + dim), with a cursor **spotlight** border and **magnetic tilt** on the focused card, a teal+lime backdrop glow, and progress dots. Reuse the existing `FeatureCard` preview widgets, `ToneSwatch`, `Reveal`, and tokens. Drive transforms via refs + `requestAnimationFrame` (no per-frame `setState`). `prefers-reduced-motion` → the existing bento grid. Keep the `Features` heading block and everything outside `Features` unchanged. Tunables (scroll length, spacing, rotation) at the top of the component. See the handoff for the exact transform math + the spotlight CSS to add to `globals.css`.

## 3. Mobile Home dashboard — fix horizontal overflow / clipped text  ⏳ to build
**Files:** `src/app/home/page.tsx`, `src/components/ActionCard.tsx`. **Full spec:** the "ALSO FIX" section at the bottom of `FEATURE_COVERFLOW_HANDOFF.md`.

Summary: on phones the right-column action cards, "Quick actions", and suggestion tiles get clipped at the right edge (content wider than viewport; root `overflow-x-hidden` hides the spillover). `AppShell` padding, the aurora, and the stats/suggestion grids are already fine. Prime suspects: `ActionCard`'s fixed `h-[260px]`/`h-[120px]` (switch to `min-h-` + bottom padding that clears the absolute badge) and missing `min-w-0` on the action-grid children. Use the runtime overflow-finder snippet in the handoff to pinpoint the exact node. **Acceptance:** no horizontal scroll or clipped text at 320/360/390/414px; cards grow to fit content; desktop unchanged; build passes.

## 4. Auth — "Sign up" must open the create-account view  ✅ done
**Files:** `src/app/welcome/page.tsx`, `src/app/login/page.tsx`.

There is no separate signup route; `login/page.tsx` toggles a local `mode` that defaulted to `"login"`, and the welcome "Sign up" button linked to plain `/login`. Fix applied: welcome "Sign up" now links to `/login?mode=signup`; the login page reads that param in a `useEffect` (not initial state, to avoid an SSR hydration mismatch — no `useSearchParams`/Suspense needed) and sets `mode="signup"` so the user lands on **"Create your account"** with the name field. The bottom toggle still works. **Acceptance:** from Welcome, "Sign up" → create-account view, "Log in" → login view.

## 5. Optional / nice-to-have
- **Forgot password** in `login/page.tsx` is currently a button with no handler — wire it up (Supabase reset email) or hide it until implemented.
- **Mobile bottom-nav clearance** in `AppShell.tsx` appears already handled (`<main>` `pb-[calc(8.5rem+env(safe-area-inset-bottom))]`, nav `bottom-[calc(0.75rem+env(safe-area-inset-bottom))]`). Verify on a real phone that Home CTAs aren't covered by the 7-item bar; if cramped, trim the bar to 4–5 primary items + a "More" menu.

---

## Verify before declaring done
- `cd learnmate && npm run build --webpack` succeeds with no console/runtime errors.
- `npm run dev` (port 4444): hero plays buddy → phone → chat with the green halo; Features behave per item 2 (once built); Home has no horizontal overflow at mobile widths; Welcome "Sign up" opens the create-account view.
- Redeploy (Vercel) so the live site reflects the current source — the production hero should be the phone version, not the old static one.

## If it reverts again
The intended state for each item is captured above and in the referenced files. Re-apply items in order 1→4. The two standalone concept files (`landing_preview.html`, `feature_coverflow_preview.html`) are the visual sources of truth and are safe to open directly in a browser.
