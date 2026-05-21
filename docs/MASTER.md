# LearnMate — Master Function Document

A plain-English description of every user-facing feature in the app. Implementation details (API routes, model providers, storage layer) are intentionally omitted.

---

## What the app is

**LearnMate** is a voice-first, AI-powered study companion. A student can talk to it, hand it lecture audio, get summaries and quizzes from those lectures, polish their writing, and chat with it like a tutor — all from a single dark-themed web app that also installs as a Progressive Web App on desktop and mobile.

The app runs locally in the browser. Notes, chats, quizzes, and research drafts are stored on the user's device. An account is optional — anyone can use it as a guest.

---

## Screens & what each one does

### Welcome screen — `/welcome`
First page a new visitor lands on. Introduces the app with a friendly mascot, a tagline, and two paths forward: **Log in** (or sign up) or **Continue as guest**. Returning signed-in users are sent straight to the home screen.

### Login / Sign-up — `/login`
A single page that toggles between Log in and Sign up modes. The user can:
- Sign up with name + email + password.
- Log in with existing email + password.
- Continue as a guest (no account).
- Use Google or Facebook sign-in (only shown if external auth is configured for the deployment).

### Home dashboard — `/home`
The landing page after sign-in. Shows:
- A personalized greeting and a mascot.
- Quick-action cards that jump straight into Talk, Notes, Quiz, or Research.
- A small stats strip: number of sessions, notes saved, quizzes taken, current daily streak.
- A list of recent activity (most-recent chats / sessions).

### Talk — `/talk`
A hands-free voice conversation with the study buddy.
- The user taps the mic, speaks naturally, and the bot replies in **spoken voice** (text-to-speech) plus a written transcript.
- Designed for short, casual back-and-forth: "explain Newton's third law," "quiz me on photosynthesis," etc.
- An animated mascot reacts (idle / listening / speaking) so the user knows what state the app is in.
- The page automatically chooses the best voice engine for the user's browser. If the browser can't talk to the cloud speech service (e.g. Brave, Arc), it transparently switches to a local on-device voice model that runs entirely in the browser.

### Chat — `/chat`
A traditional written chat with the AI tutor.
- The user types messages; the bot replies in formatted Markdown (headings, bullets, code blocks when relevant).
- **File attachments:** the user can attach PDFs, text files, Markdown, CSV, JSON, and other plain documents to a message. The AI reads the content and answers questions about it. Each attachment becomes a chip on the user's message bubble.
- Conversation history is kept per user, on-device.
- Starter prompts are offered when the chat is empty ("Explain recursion with an analogy", "Make me a 5-question quiz on cells", etc.).

### Notes — `/notes`
A live-transcription workspace for lectures and study sessions.
- **Take notes for my class** — name a session (title + subject), hit Record, and the app live-transcribes everything spoken. A waveform shows the mic activity. When done, the user hits Stop and Save.
- **Upload audio** — instead of recording live, the user can drop in a pre-recorded `.m4a` / `.mp3` / `.wav` / `.webm` (up to 25 MB) and the app transcribes it.
- **AI actions** on any session's transcript:
  - **Summarize** — turns the raw transcript into a clean bulleted study sheet.
  - **Rewrite** — rewrites the transcript into well-structured Markdown notes, fixing grammar and typos while keeping the information intact.
- **Clear transcript** — wipes the raw transcript on a session (AI outputs stay).
- **Delete note** — removes the whole session (with confirmation). Any quizzes that were generated from that note are removed too.
- **Library view** — all saved sessions, grouped by Today / Yesterday / This week / Earlier / Saved, with quick search.
- A small status pill shows which voice engine is in use (Cloud or Local).

### Quiz — `/quiz`
AI-generated multiple-choice quizzes on any topic.
- The user picks a topic (or one of the suggested topics) and a question count.
- The app generates the quiz, then walks the user through it one question at a time.
- For each question the user picks one of four options. The app shows whether the answer was right or wrong and a one- or two-sentence explanation of the correct answer.
- At the end, a score screen shows total correct, percentage, and an option to retry or generate a new quiz.
- All quizzes the user has taken are stored locally, along with their attempts and scores.

### Research — `/research`
A writing-polish workspace.
- The user pastes a draft (essay, paragraph, email, etc.) into a textarea.
- The app analyzes it and returns:
  - An overall **clarity / quality score**.
  - A short **overall summary** of strengths and weaknesses.
  - A list of **inline suggestions**, each tagged as a spelling, grammar, clarity, or style issue.
- For each suggestion the user can **Accept** (apply the change) or **Reject** (dismiss it). Accepted edits are applied to the draft.
- The user can keep iterating: re-analyze the polished draft for another pass.

### Account menu
On every screen after sign-in, the avatar (top-right on desktop, in the sidebar bottom on desktop, and via the avatar chip on mobile) opens a small menu with the user's name, email, and a **Sign out** action.

---

## Cross-cutting features

### Voice
- Live transcription works in `/talk` and `/notes`.
- The app picks the right voice engine automatically for the user's browser. If cloud speech is blocked, it falls back to an on-device voice model (no extra setup required by the user).
- Text-to-speech is used in `/talk` so the bot's replies are spoken aloud.

### File handling
- `/chat` accepts text-based file attachments (PDF, txt, md, csv, json, html, etc.) up to 8 MB each, max ~18,000 characters per file.
- `/notes` accepts audio uploads up to 25 MB.

### Data & privacy
- Everything the user does — chats, notes, quizzes, research drafts, attempts — is stored **on the user's device**, in the browser's local database.
- Signing out leaves the data in place on the device unless the user manually clears site data.
- Optional account sync (across devices) is gated behind a deployment setting and is not enabled by default.

### Installable app (PWA)
- The site can be installed as an app on desktop, Android, and iOS. It then opens like a normal app, in its own window, with the LearnMate mascot as the icon.
- The app shell loads instantly on repeat visits even with a poor connection. AI requests still require the internet.

### Look & feel
- Dark theme, soft glass-panel surfaces, accent colors (teal, lime, blue, purple, pink).
- Friendly mascot character that reacts to state (idle, listening, speaking).
- A collapsible sidebar on desktop so the user can give the main content more room.
- A bottom nav bar on mobile.

### Accessibility & resilience
- Friendly error messages when the AI service is rate-limited, when the microphone is blocked, or when an unsupported browser tries to use voice.
- Reduced-motion support: subtle animations are disabled when the user prefers reduced motion.
- Keyboard-accessible buttons and aria labels throughout.

---

## Out of scope (currently)

- The app does not store user data on a server by default.
- There is no multi-language UI — the interface is English-only.
- There is no in-app notification system.
- There is no real-time collaboration between users.
