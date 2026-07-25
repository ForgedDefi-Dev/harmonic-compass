import type { PitchClass, StableChordEvent, TonalContext } from "@/types/music";
import { mod12, scaleChords } from "./theory";

interface WeightedChord {
  root: number;
  quality: string;
  weight: number;
}

function normalizeEvents(events: StableChordEvent[]): WeightedChord[] {
  return events
    .filter((event) => event.primary.confidence >= 0.35)
    .map((event) => ({
      root: event.primary.chord.root,
      quality: event.primary.chord.quality,
      weight:
        event.primary.confidence *
        Math.max(0.5, Math.min(8, ((event.endMs ?? event.startMs + 1500) - event.startMs) / 1000)),
    }));
}

export function inferKey(
  events: StableChordEvent[],
  locked?: TonalContext["primary"],
): TonalContext {
  if (locked) return { primary: locked, alternatives: [], locked: true };
  const chords = normalizeEvents(events);
  if (chords.length < 2) return { alternatives: [], locked: false };

  const candidates = (["major", "minor"] as const).flatMap((mode) =>
    Array.from({ length: 12 }, (_, tonic) => {
      const scale = scaleChords(tonic as PitchClass, mode);
      let score = 0;
      let total = 0;

      chords.forEach((event, index) => {
        total += event.weight;
        const degree = scale.findIndex((chord) => chord.root === event.root);
        if (degree < 0) {
          score -= event.weight * 0.55;
          return;
        }
        score += event.weight * 0.72;
        if (scale[degree].quality === event.quality) score += event.weight * 0.48;
        if (degree === 0) score += event.weight * (index === chords.length - 1 ? 0.48 : 0.24);

        const previous = chords[index - 1];
        if (previous && mod12(previous.root - tonic) === 7 && degree === 0) {
          score += Math.min(previous.weight, event.weight) * 0.7;
        }
      });

      return { tonic: tonic as PitchClass, mode, raw: score / Math.max(1, total) };
    }),
  );

  candidates.sort((a, b) => b.raw - a.raw);
  const best = candidates[0];
  const runnerUp = candidates[1];
  const evidence = Math.min(1, chords.length / 5);
  const margin = Math.max(0, best.raw - runnerUp.raw);
  const confidence = Math.max(0.28, Math.min(0.97, 0.38 + evidence * 0.35 + margin * 0.35));

  return {
    primary: { tonic: best.tonic, mode: best.mode, confidence },
    alternatives:
      runnerUp.raw >= best.raw - 0.22
        ? [
            {
              tonic: runnerUp.tonic,
              mode: runnerUp.mode,
              confidence: Math.max(0.2, confidence - Math.max(0.08, margin)),
            },
          ]
        : [],
    locked: false,
  };
}
