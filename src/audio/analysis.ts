import type { ChordCandidate, ChordQuality, ChordSymbol, PitchClass } from "@/types/music";
import { chordPitchClasses, mod12 } from "@/music/theory";

export const ANALYSIS_WINDOW_SIZE = 8192;
export const ANALYSIS_HOP_SIZE = 1024;

export interface AnalysisResult {
  atMs: number;
  rms: number;
  onset: boolean;
  tuningCents: number;
  primary?: ChordCandidate;
  alternative?: ChordCandidate;
}

const DETECTABLE_QUALITIES: ChordQuality[] = [
  "major",
  "minor",
  "dominant7",
  "major7",
  "minor7",
  "sus2",
  "sus4",
  "diminished",
  "power",
];

export interface SpectrumFrame {
  magnitudes: Float32Array;
  sampleRate: number;
  fftSize: number;
  rms: number;
  atMs: number;
  onset: boolean;
}

interface RankedTemplate {
  chord: ChordSymbol;
  score: number;
}

export function hannWindow(input: Float32Array): Float32Array {
  const output = new Float32Array(input.length);
  const denominator = Math.max(1, input.length - 1);
  for (let index = 0; index < input.length; index += 1) {
    output[index] = input[index] * (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / denominator));
  }
  return output;
}

export function rootMeanSquare(input: Float32Array): number {
  if (input.length === 0) return 0;
  let sum = 0;
  for (const sample of input) sum += sample * sample;
  return Math.sqrt(sum / input.length);
}

export function spectrumToChroma(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
): { chroma: Float32Array; bass: Float32Array; tuningCents: number } {
  const chroma = new Float32Array(12);
  const bass = new Float32Array(12);
  let tuningNumerator = 0;
  let tuningDenominator = 0;
  const binHz = sampleRate / fftSize;

  for (let bin = 1; bin < magnitudes.length; bin += 1) {
    const frequency = bin * binHz;
    if (frequency < 65 || frequency > 2100) continue;
    const magnitude = magnitudes[bin];
    if (magnitude <= 0) continue;

    const midi = 69 + 12 * Math.log2(frequency / 440);
    const nearest = Math.round(midi);
    const pitch = mod12(nearest);
    const cents = (midi - nearest) * 100;
    const spectralWeight = magnitude / Math.sqrt(Math.max(1, frequency / 110));
    const tuningWeight = magnitude * magnitude;
    chroma[pitch] += spectralWeight;
    if (frequency <= 330) bass[pitch] += spectralWeight;
    tuningNumerator += cents * tuningWeight;
    tuningDenominator += tuningWeight;
  }

  normalize(chroma);
  normalize(bass);
  return {
    chroma,
    bass,
    tuningCents:
      tuningDenominator > 0 ? Math.max(-50, Math.min(50, tuningNumerator / tuningDenominator)) : 0,
  };
}

function normalize(values: Float32Array): void {
  let norm = 0;
  for (const value of values) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm === 0) return;
  for (let index = 0; index < values.length; index += 1) values[index] /= norm;
}

function scoreTemplate(chroma: Float32Array, bass: Float32Array, chord: ChordSymbol): number {
  const tones = new Set(chordPitchClasses(chord));
  let included = 0;
  let excluded = 0;
  for (let pitch = 0; pitch < 12; pitch += 1) {
    if (tones.has(pitch as PitchClass)) included += chroma[pitch];
    else excluded += chroma[pitch];
  }
  const rootEvidence = bass[chord.root] * 0.18 + chroma[chord.root] * 0.08;
  const complexityPenalty = tones.size === 4 ? 0.025 : 0;
  return included / Math.sqrt(tones.size) - excluded * 0.12 + rootEvidence - complexityPenalty;
}

export function classifyChroma(
  chroma: Float32Array,
  bass: Float32Array,
): { primary?: ChordCandidate; alternative?: ChordCandidate } {
  const ranked: RankedTemplate[] = [];
  for (let root = 0; root < 12; root += 1) {
    for (const quality of DETECTABLE_QUALITIES) {
      const chord: ChordSymbol = { root: root as PitchClass, quality };
      ranked.push({ chord, score: scoreTemplate(chroma, bass, chord) });
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const distinct = ranked.find(
    (candidate) =>
      candidate.chord.root !== best.chord.root || candidate.chord.quality !== best.chord.quality,
  );
  if (!best || !distinct) return {};

  const margin = Math.max(0, best.score - distinct.score);
  const absolute = Math.max(0, Math.min(1, (best.score - 0.35) / 0.55));
  const confidence = Math.max(0, Math.min(0.98, absolute * 0.62 + margin * 2.4));
  if (confidence < 0.38) return {};

  const primary = { chord: best.chord, confidence };
  const alternativeConfidence = Math.max(0, Math.min(confidence - 0.04, confidence - margin * 1.4));
  return {
    primary,
    alternative:
      alternativeConfidence >= 0.34 && margin < 0.11
        ? { chord: distinct.chord, confidence: alternativeConfidence }
        : undefined,
  };
}

export function analyzeMagnitudeSpectrum(frame: SpectrumFrame): AnalysisResult {
  if (frame.rms < 0.006) {
    return {
      atMs: frame.atMs,
      rms: frame.rms,
      onset: frame.onset,
      tuningCents: 0,
    };
  }
  const { chroma, bass, tuningCents } = spectrumToChroma(
    frame.magnitudes,
    frame.sampleRate,
    frame.fftSize,
  );
  const classified = classifyChroma(chroma, bass);
  return {
    atMs: frame.atMs,
    rms: frame.rms,
    onset: frame.onset,
    tuningCents,
    ...classified,
  };
}
