# Harmonic Compass

**Never feel lost after playing a chord.**

Harmonic Compass is an installable, local-first songwriting workspace for guitarists. It listens to clean solo guitar in the browser, identifies likely chords and key, maps emotionally meaningful next destinations, captures ideas, and turns a player’s own music into short learning challenges.

## What ships

- Live microphone chord recognition with honest uncertainty and manual correction
- A six-bearing harmonic Compass with Beginner, Developing, and Advanced guidance
- Emotional routes: Direct, Build, and Twist
- Progression capture, section building, variations, looping, and versions
- Optional deterministic drums, bass, and pad accompaniment
- Local-first Grow recommendations and Library persistence
- A text-only OpenAI mentor with a complete deterministic local fallback
- A no-permission Showcase Mode for convention demos
- Offline PWA behavior after the first successful visit

AI speech is intentionally not included. There is no speech-to-text, text-to-speech, voice assistant, or Realtime voice integration.

## Quick start

Requirements: Node.js 22+ and pnpm 10.29+.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Choose **Play guided showcase** for the deterministic showcase, or **Start listening** to use a microphone.

The app is useful without environment variables. To enable the optional remote mentor:

```bash
copy .env.example .env.local
```

Set `OPENAI_API_KEY`; keep it server-side. `OPENAI_MODEL` defaults to `gpt-5.6`.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm demo:video
```

`pnpm demo:video` records the repeatable Showcase Mode journey for competition review.

## Privacy contract

- Microphone frames are analyzed in an AudioWorklet/Web Worker and discarded.
- Raw audio never leaves the browser.
- The remote mentor receives bounded symbolic musical context only.
- No song titles, chord sequences, recordings, or mentor questions enter telemetry.
- All core features work without an OpenAI key.

## Live-audio support

The certified target is a current Chrome or Edge desktop foreground tab, a built-in/USB microphone or audio interface, and one clean standard-tuned guitar. Safari and mobile browsers are feature-detected and supported with looser latency expectations. Capo is manual. Full-band audio, heavy distortion, automatic alternate-tuning inference, tablature transcription, and exact inversion detection are outside v1.

## Architecture

- Next.js App Router and Serwist PWA shell
- AudioWorklet capture and Web Worker FFT/chroma analysis
- Pure TypeScript harmonic ranking using Tonal
- Dexie/IndexedDB local persistence
- Tone.js preview and accompaniment scheduling
- Zod-validated import/export and mentor contracts

See `AGENTS.md` for repository invariants and exact commands.

## Deployment

The project is configured for Vercel. A deployment without secrets runs the local Compass Coach; adding `OPENAI_API_KEY` enables the validated text mentor endpoint. Production must remain HTTPS because browser microphone access requires a secure context.
