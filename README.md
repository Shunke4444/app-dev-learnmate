# LearnMate

Free, voice-first AI study assistant. Talk, chat, take notes, generate quizzes, polish research — runs entirely in the browser on free OpenRouter models. Local-first (IndexedDB), installable PWA, zero subscription.

Built with Next.js 16 (App Router) + TypeScript + Tailwind v4 + Zustand + Dexie + Serwist.

## Quick start

```bash
git clone https://github.com/Shunke4444/app-dev-learnmate.git
cd learnmate
npm install
cp .env.local.example .env.local      # paste your OpenRouter key
npm run dev                            # http://localhost:4444
```

You only need **one** secret: `OPENROUTER_API_KEY`. Get a free key at https://openrouter.ai/keys (no credit card). The app loads without it but shows a banner and AI features stay disabled.

## Production build

```bash
npm run build         # uses webpack so Serwist can bundle the service worker
npm start             # serves on http://localhost:4444
```

> Next.js 16 defaults to Turbopack, but Serwist's webpack plugin doesn't run under it. `dev` keeps Turbopack (fast HMR); `build` uses `--webpack` so the PWA service worker is emitted. Serwist auto-disables in dev to keep iteration fast.

## Deploy to Vercel

1. Push to GitHub.
2. Import the repo on Vercel.
3. Project Settings → Environment Variables → add `OPENROUTER_API_KEY` (and optional vars from `.env.local.example`).
4. Deploy. Vercel runs `npm run build` (which already passes `--webpack`) and serves on HTTPS — required for the Web Speech API mic prompt.

Service worker registers automatically. To install as a PWA: Chrome desktop → address-bar install icon; mobile Safari → Share → Add to Home Screen.

## Routes

| Route | Description |
|---|---|
| `/` | Public marketing landing page |
| `/welcome` | Entry — log in / sign up / continue as guest |
| `/login` | Email + password mock auth (with show/hide toggle) |
| `/home` | Dashboard with action cards + recent activity |
| `/talk` | Voice conversation (STT → AI → TTS) |
| `/chat` | Streaming text chat |
| `/notes` | Continuous voice notes + summarize / rewrite / save |
| `/quiz` | Generate MCQs from a topic, take the quiz, see score |
| `/research` | Paste a draft, get score + suggestions, accept inline edits |
| `/manifest.webmanifest` | PWA manifest (generated from `src/app/manifest.ts`) |
| `/api/ai/chat` | SSE proxy → OpenRouter chat completion |
| `/api/ai/quiz` | Strict JSON schema → validated quiz payload |
| `/api/ai/research` | Strict JSON schema → score + suggestions |

## Environment variables

| Var | Required | Default |
|---|---|---|
| `OPENROUTER_API_KEY` | ✅ | — |
| `OPENROUTER_MODEL` | optional | `meta-llama/llama-3.3-70b-instruct:free` |
| `OPENROUTER_FALLBACKS` | optional | per-job catalog in `src/lib/ai/models.ts` |
| `OPENROUTER_ALLOW_PAID` | optional | `false` (rejects any model id not ending in `:free`) |
| `NEXT_PUBLIC_APP_URL` | optional | `http://localhost:4444` |
| `NEXT_PUBLIC_SUPABASE_URL` | optional | — (enables Google/Facebook OAuth buttons when both set) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional | — |

The OpenRouter key **never reaches the browser** — all AI calls go through Next.js server route handlers under `/api/ai/*`.

## Auth

Mock auth is built in: email + password validation, "Continue as guest", localStorage persistence via Zustand. No real backend yet. Sign-out menu in the sidebar + topbar avatar. Real OAuth + multi-device sync via Supabase is env-gated — drop the two Supabase vars in to enable the social buttons (the actual OAuth wiring is the next sprint).

## Voice

- **STT (listening):** `window.SpeechRecognition` — Chrome, Edge, Safari 14.1+. Firefox is currently unsupported; the Whisper-in-browser fallback (Transformers.js / WebGPU) is planned.
- **TTS (speaking):** `window.speechSynthesis` — all modern browsers.
- **Waveform:** Web Audio `AnalyserNode` → normalized 0..1 amplitude stream → animated bars.

HTTPS is required for mic access. `localhost` is exempt in dev.

## Free-model rate limits

OpenRouter `:free` models cap at ~20 req/min per model and ~50 req/day on accounts with no purchased credits (~1000/day after a one-time $10 credit purchase — credits are not consumed by `:free` models). When a model returns 429 the fallback chain in `src/lib/ai/models.ts` tries the next one, multiplying effective daily budget. The UI surfaces a friendly "Bot is resting" state when the chain is exhausted.

## Project layout

```
src/
├─ app/
│  ├─ _landing/LandingPage.tsx       # public marketing page
│  ├─ welcome/                       # entry + guest path
│  ├─ login/                         # mock auth UI
│  ├─ home/talk/chat/notes/quiz/research/    # app routes (guarded)
│  ├─ api/ai/{chat,quiz,research}/   # OpenRouter proxy
│  ├─ manifest.ts                    # PWA manifest (Next 16 file convention)
│  └─ sw.ts                          # Serwist service worker
├─ components/AppShell.tsx           # sidebar + topbar + auth guard + UserMenu
├─ lib/
│  ├─ ai/{openrouter,models,schemas}.ts
│  ├─ auth/{store,config}.ts
│  ├─ voice/{recognition,tts,waveform}.ts
│  ├─ db/dexie.ts                    # IndexedDB tables + helpers
│  └─ env.ts                         # server-only env reader
└─ public/icons/                     # PWA icons (run scripts/gen-icons.mjs to regenerate)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 4444 (Turbopack, Serwist disabled) |
| `npm run build` | Production build with webpack + Serwist |
| `npm start` | Serve the built app on port 4444 |
| `npm run lint` | ESLint over `src/` |
| `node scripts/gen-icons.mjs` | Regenerate PWA icons from `public/mascot/idle.png` |

## Roadmap

Per `LearnMate_Build_Plan.md` (in the parent directory): S0–S5 + S7 shipped. Remaining: PDF/image upload in `/research` (S6 polish), make-quiz-from-notes button (S4 polish), voice answer matching (S5 polish), Transformers.js Whisper fallback for Firefox, real Supabase OAuth + sync, and the S8 a11y/QA pass.
