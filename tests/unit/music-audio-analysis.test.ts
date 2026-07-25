import { describe, expect, it } from "vitest";
import { analyzeMagnitudeSpectrum, classifyChroma, estimateTempo, tempoFromTaps } from "@/audio";
import { chordPitchClasses } from "@/music";
import type { ChordSymbol } from "@/types/music";

function chromaFor(chord: ChordSymbol): { chroma: Float32Array; bass: Float32Array } {
  const chroma = new Float32Array(12);
  const bass = new Float32Array(12);
  for (const pitch of chordPitchClasses(chord)) chroma[pitch] = 0.56;
  chroma[chord.root] = 0.66;
  bass[chord.root] = 1;
  return { chroma, bass };
}

describe("chord template analysis", () => {
  it.each([
    { root: 0, quality: "major" },
    { root: 2, quality: "minor" },
    { root: 7, quality: "dominant7" },
    { root: 9, quality: "minor7" },
    { root: 5, quality: "sus4" },
  ] as ChordSymbol[])("recognizes synthetic $root $quality chroma", (chord) => {
    const { chroma, bass } = chromaFor(chord);
    const result = classifyChroma(chroma, bass);
    expect(result.primary?.chord).toEqual(chord);
    expect(result.primary?.confidence).toBeGreaterThan(0.38);
  });

  it("abstains on silence rather than inventing a chord", () => {
    const result = analyzeMagnitudeSpectrum({
      magnitudes: new Float32Array(4096),
      sampleRate: 48_000,
      fftSize: 8192,
      rms: 0.001,
      onset: false,
      atMs: 120,
    });
    expect(result.primary).toBeUndefined();
    expect(result.rms).toBe(0.001);
  });
});

describe("tempo estimation", () => {
  it("finds a stable 120 BPM pulse", () => {
    const tempo = estimateTempo([0, 500, 1000, 1500, 2000, 2500, 3000]);
    expect(tempo.bpm).toBe(120);
    expect(tempo.confidence).toBeGreaterThan(0.5);
  });

  it("normalizes half-time pulses into the guitar-friendly range", () => {
    expect(estimateTempo([0, 1000, 2000, 3000, 4000]).bpm).toBe(120);
  });

  it("locks tempo after four deliberate taps", () => {
    const tempo = tempoFromTaps([100, 725, 1350, 1975]);
    expect(tempo.bpm).toBe(96);
    expect(tempo.source).toBe("tap");
    expect(tempo.locked).toBe(true);
  });
});
