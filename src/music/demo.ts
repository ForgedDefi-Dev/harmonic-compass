import type { ChordSymbol, StableChordEvent } from "@/types/music";

export const SHOWCASE_BPM = 96;

export const SHOWCASE_PROGRESSION: ChordSymbol[] = [
  { root: 0, quality: "major" },
  { root: 7, quality: "major" },
  { root: 9, quality: "minor" },
  { root: 5, quality: "major" },
  { root: 5, quality: "minor" },
  { root: 0, quality: "major" },
];

export function createShowcaseEvents(startMs = 0): StableChordEvent[] {
  const chordDuration = (60_000 / SHOWCASE_BPM) * 4;
  return SHOWCASE_PROGRESSION.map((current, index) => ({
    id: `00000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`,
    startMs: startMs + index * chordDuration,
    endMs: startMs + (index + 1) * chordDuration,
    primary: { chord: current, confidence: index === 4 ? 0.9 : 0.96 },
    alternatives: [],
    confidenceBand: "high",
    status: "confirmed",
    source: "demo",
  }));
}

export const SHOWCASE_OBSERVATIONS = createShowcaseEvents().flatMap((event) => [
  {
    atMs: event.startMs,
    chord: event.primary.chord,
    confidence: Math.max(0.55, event.primary.confidence - 0.18),
    status: "provisional" as const,
  },
  {
    atMs: event.startMs + 260,
    chord: event.primary.chord,
    confidence: event.primary.confidence,
    status: "confirmed" as const,
  },
]);
