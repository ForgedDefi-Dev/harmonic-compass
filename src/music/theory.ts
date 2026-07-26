import type { ChordQuality, ChordSymbol, PitchClass, TonalContext } from "@/types/music";

export const SHARP_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;

export const FLAT_NAMES = [
  "C",
  "D♭",
  "D",
  "E♭",
  "E",
  "F",
  "G♭",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
] as const;

const FLAT_KEYS = new Set([1, 3, 5, 8, 10]);

export const mod12 = (value: number): PitchClass => (((value % 12) + 12) % 12) as PitchClass;

export function pitchName(pitch: PitchClass, preferFlats = false): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[pitch];
}

export function qualitySuffix(quality: ChordQuality): string {
  switch (quality) {
    case "major":
      return "";
    case "minor":
      return "m";
    case "dominant7":
      return "7";
    case "major7":
      return "maj7";
    case "minor7":
      return "m7";
    case "major6":
      return "6";
    case "minor6":
      return "m6";
    case "add9":
      return "add9";
    case "minorAdd9":
      return "m(add9)";
    case "dominant9":
      return "9";
    case "major9":
      return "maj9";
    case "minor9":
      return "m9";
    case "halfDiminished":
      return "m7b5";
    case "sus2":
      return "sus2";
    case "sus4":
      return "sus4";
    case "diminished":
      return "dim";
    case "augmented":
      return "aug";
    case "power":
      return "5";
  }
}

export function formatChord(chord: ChordSymbol, context?: TonalContext["primary"]): string {
  const flats = context ? FLAT_KEYS.has(context.tonic) : false;
  const bass =
    chord.bass !== undefined && chord.bass !== chord.root ? `/${pitchName(chord.bass, flats)}` : "";
  return `${pitchName(chord.root, flats)}${qualitySuffix(chord.quality)}${bass}`;
}

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11] as const;
export const NATURAL_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10] as const;
export const MAJOR_QUALITIES: ChordQuality[] = [
  "major",
  "minor",
  "minor",
  "major",
  "major",
  "minor",
  "diminished",
];
export const MINOR_QUALITIES: ChordQuality[] = [
  "minor",
  "diminished",
  "major",
  "minor",
  "minor",
  "major",
  "major",
];

export function scaleChords(tonic: PitchClass, mode: "major" | "minor"): ChordSymbol[] {
  const intervals = mode === "major" ? MAJOR_SCALE : NATURAL_MINOR_SCALE;
  const qualities = mode === "major" ? MAJOR_QUALITIES : MINOR_QUALITIES;
  return intervals.map((interval, index) => ({
    root: mod12(tonic + interval),
    quality: qualities[index],
  }));
}

export function chordPitchClasses(chord: ChordSymbol): PitchClass[] {
  const intervals: Record<ChordQuality, number[]> = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dominant7: [0, 4, 7, 10],
    major7: [0, 4, 7, 11],
    minor7: [0, 3, 7, 10],
    major6: [0, 4, 7, 9],
    minor6: [0, 3, 7, 9],
    add9: [0, 2, 4, 7],
    minorAdd9: [0, 2, 3, 7],
    dominant9: [0, 2, 4, 7, 10],
    major9: [0, 2, 4, 7, 11],
    minor9: [0, 2, 3, 7, 10],
    halfDiminished: [0, 3, 6, 10],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8],
    power: [0, 7],
  };
  return intervals[chord.quality].map((interval) => mod12(chord.root + interval));
}

export function romanNumeral(chord: ChordSymbol, key?: TonalContext["primary"]): string {
  if (!key) return "—";
  const intervals = key.mode === "major" ? MAJOR_SCALE : NATURAL_MINOR_SCALE;
  const offset = mod12(chord.root - key.tonic);
  const degree = (intervals as readonly number[]).indexOf(offset);
  const numerals = ["I", "II", "III", "IV", "V", "VI", "VII"];
  if (degree < 0) return "borrowed";

  let numeral = numerals[degree];
  if (
    ["minor", "minor7", "minor6", "minorAdd9", "minor9", "diminished", "halfDiminished"].includes(
      chord.quality,
    )
  ) {
    numeral = numeral.toLowerCase();
  }
  if (chord.quality === "diminished") numeral += "°";
  if (["dominant7", "major7", "minor7", "halfDiminished"].includes(chord.quality)) numeral += "7";
  if (["dominant9", "major9", "minor9"].includes(chord.quality)) numeral += "9";
  return numeral;
}

export function sameChord(a: ChordSymbol, b: ChordSymbol): boolean {
  return a.root === b.root && a.quality === b.quality && a.bass === b.bass;
}

export function guitarPlayability(chord: ChordSymbol): number {
  const easyRoots = new Set([0, 2, 4, 7, 9]);
  let score = easyRoots.has(chord.root) ? 0.9 : 0.68;
  if (
    ["major", "minor", "power", "sus2", "sus4", "major6", "minor6", "add9", "minorAdd9"].includes(
      chord.quality,
    )
  ) {
    score += 0.06;
  }
  if (["diminished", "augmented"].includes(chord.quality)) score -= 0.18;
  return Math.max(0, Math.min(1, score));
}

export function voiceLeadingScore(from: ChordSymbol, to: ChordSymbol): number {
  const a = chordPitchClasses(from);
  const b = chordPitchClasses(to);
  const distances = a.map((pitch) =>
    Math.min(...b.map((other) => Math.min(mod12(pitch - other), mod12(other - pitch)))),
  );
  const average = distances.reduce((sum, value) => sum + value, 0) / distances.length;
  return Math.max(0, Math.min(1, 1 - average / 4));
}
