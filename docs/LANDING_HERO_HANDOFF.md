# Handoff: port the LearnMate landing hero into the app (for Claude Code)

**Goal:** Recreate the hero from the working concept file `learnmate/docs/landing_preview.html` inside the real Next.js app at `learnmate/src/app/_landing/LandingPage.tsx`. Translate its plain CSS/JS into React + Tailwind, keep the rest of the production landing untouched.

## The effect (in order)
1. **Hero = a 3D mascot ("buddy")** rendered with Three.js — dark rounded head, two glowing teal eyes. The **head follows the mouse and the eyes shift toward the cursor** (eye-tracking). Tagline under it: **"Your learning buddy."**
2. **On scroll, zoom out** to reveal the buddy was inside a **realistic phone** (titanium edge, side buttons, dynamic island, status bar, screen reflection).
3. **Phone turns** a little (rotateY ~ -24°) as you keep scrolling.
4. The screen **becomes a chat** that reveals message-by-message, tied to scroll (user asks → bot replies → quiz → "save as note").
5. Final section: **"Everything you need to study. / Nothing you'd pay for."** + chips ($0 · no card · free AI · offline · PWA).

`landing_preview.html` is the source of truth for layout, palette, timings, and the chat copy — open it and mirror its behavior.

## Tech & install
```bash
cd learnmate
npm i three @react-three/fiber          # @react-three/drei optional
```
Build/verify with the project's commands: `npm run build --webpack` and `npm run dev` (port 4444). Put the work on a branch.

## Hard requirements (lessons learned — do not skip)
- **Never let WebGL block the page.** Wrap the 3D init so a failed WebGL context can't throw and halt render (try/catch, or react-three-fiber's error boundary). On failure, **fall back to the static mascot image** (`/AI.png` — copy `APPDEV/AI.png` into `learnmate/public/` if not already there). The page must look right even with WebGL disabled.
- **Size the canvas from the container/window, not a 0-width element** (sizing from `clientWidth` at mount caused a blank canvas on desktop). With react-three-fiber `<Canvas>` this is handled; with raw Three, use `innerWidth/innerHeight` or a ResizeObserver.
- **Buddy stays visible from the start through the whole zoom**, and only fades out exactly as the chat fades in (z-index above the phone, transparent canvas so the phone reveals through/around it).
- **Green backdrop glow behind the 3D logo.** Place a soft teal→lime radial halo *behind* the buddy (rendered before the WebGL canvas so the buddy sits on top and the glow shows through the transparent canvas around it), centered on the buddy. Suggested: an element ~`72vmin × 58vmin`, `radial-gradient(closest-side, rgba(52,224,196,0.36), rgba(52,224,196,0.15) 46%, rgba(200,246,93,0.07) 66%, transparent 78%)`, `blur(10px)`. It must live **inside the buddy/stage layer** so it scales and fades together with the buddy as you scroll into the phone (don't let it linger over the phone). Matches the green halo in the reference screenshot.
- Keep **Poppins** and the existing CSS tokens (`--bg #0b0f0e`, `--surface`, `--teal #34e0c4`, `--lime #c8f65d`, `--purple`, 24px card radius). Reuse the existing **`Reveal`** component for scroll-in sections.
- Respect `prefers-reduced-motion` (disable the 3D spin/scroll transforms, show the static hero + chat).
- **No first-paint flash.** Don't let the un-zoomed initial state (small phone + buddy) flash before the scroll script positions things. Gate the sticky hero invisible (`opacity-0`) until the first positioning frame runs, then fade in (`transition-opacity duration-200`) via a `ready` flag set immediately after that first `frame()`. Set `ready` unconditionally so the hero can never get stuck hidden.
- Don't touch the rest of `LandingPage.tsx` (Features, VoiceShowcase, etc.) — only add/replace the hero + the scroll-chat + the value section.

## 3D buddy spec (matches the concept)
- Head: `SphereGeometry(1.7,64,64)`, `MeshStandardMaterial({color:0x0c100f, roughness:.32, metalness:.25})`, scaled `(1.3, .95, .92)`.
- Eyes: two `SphereGeometry(0.34,32,32)`, `MeshStandardMaterial({color:0