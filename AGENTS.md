# Harmonic Compass Agent Guide

## Product

Harmonic Compass is a local-first Next.js PWA that recognizes clean solo-guitar
chords, maps harmonic destinations, captures song ideas, and turns those ideas
into contextual learning exercises.

## Commands

- `pnpm dev` — run the app
- `pnpm lint` — lint
- `pnpm typecheck` — strict TypeScript
- `pnpm test` — unit and domain tests
- `pnpm test:e2e` — browser tests
- `pnpm build` — production build
- `pnpm verify` — complete local verification
- `pnpm demo:video` — record the deterministic Showcase Mode

## Architecture

- `src/audio` owns capture, worklet/worker analysis, playback, and audio lifecycle.
- `src/music` owns pure harmonic analysis and recommendation logic.
- `src/storage` owns versioned local persistence and import/export.
- `src/components` owns accessible product UI.
- `src/app/api/mentor` is the only optional server AI surface.

## Code Review Rules

1. Raw microphone audio, recordings, chord sequences, song titles, and mentor
   prompts must never enter telemetry. Raw audio never leaves the browser.
2. Do not add speech recognition, text-to-speech, Realtime voice, spoken coaching,
   or voice-control dependencies. AI speech is explicitly deferred.
3. DSP must remain off the React/main rendering path. Every music-engine behavior
   change requires deterministic golden tests and honest uncertainty handling.
4. Play, Build, Grow, Library, previews, and the local Compass Coach must remain
   useful without network access or an OpenAI key.
5. Do not auto-apply mentor suggestions. The deterministic harmonic engine owns
   valid actions; the model may only explain supplied context and action IDs.
