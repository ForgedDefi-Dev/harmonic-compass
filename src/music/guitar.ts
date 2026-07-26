export type GuitarFret = number;
export type GuitarTuningId = "standard" | "half-step-down" | "drop-d" | "open-g" | "dadgad";

export interface GuitarTuning {
  id: GuitarTuningId;
  label: string;
  shortLabel: string;
  midi: readonly [number, number, number, number, number, number];
}

export const GUITAR_TUNINGS: readonly GuitarTuning[] = [
  {
    id: "standard",
    label: "Standard · E A D G B E",
    shortLabel: "Standard",
    midi: [40, 45, 50, 55, 59, 64],
  },
  {
    id: "half-step-down",
    label: "Half-step down · E♭ A♭ D♭ G♭ B♭ E♭",
    shortLabel: "½ step down",
    midi: [39, 44, 49, 54, 58, 63],
  },
  {
    id: "drop-d",
    label: "Drop D · D A D G B E",
    shortLabel: "Drop D",
    midi: [38, 45, 50, 55, 59, 64],
  },
  {
    id: "open-g",
    label: "Open G · D G D G B D",
    shortLabel: "Open G",
    midi: [38, 43, 50, 55, 59, 62],
  },
  {
    id: "dadgad",
    label: "DADGAD · D A D G A D",
    shortLabel: "DADGAD",
    midi: [38, 45, 50, 55, 57, 62],
  },
] as const;

export interface GuitarVoicing {
  id: string;
  chord: string;
  frets: readonly [GuitarFret, GuitarFret, GuitarFret, GuitarFret, GuitarFret, GuitarFret];
  fingers: readonly [GuitarFret, GuitarFret, GuitarFret, GuitarFret, GuitarFret, GuitarFret];
  name: string;
  style: "open" | "barre" | "movable" | "high-neck" | "partial";
  difficulty: 1 | 2 | 3 | 4 | 5;
  fretSpan: number;
  minFret: number;
  maxFret: number;
  openStrings: number;
  mutedStrings: number;
  barreFret?: number;
  sharedStrings?: number;
  voiceLeadingScore?: number;
}

export interface GuitarVoicingQuery {
  tuning?: GuitarTuningId;
  capo?: number;
  previous?: GuitarVoicing | readonly GuitarFret[];
  limit?: number;
}

export interface ChordColorVariant {
  chord: string;
  label: string;
  description: string;
}

export interface FretShapeMatch {
  chord: string;
  confidence: number;
  intervals: string[];
  detail: string;
}

interface RawVoicing {
  chord: string;
  frets: readonly [GuitarFret, GuitarFret, GuitarFret, GuitarFret, GuitarFret, GuitarFret];
  fingers: readonly [GuitarFret, GuitarFret, GuitarFret, GuitarFret, GuitarFret, GuitarFret];
  name: string;
}

interface ParsedGuitarChord {
  root: number;
  bass?: number;
  quality: string;
  intervals: readonly number[];
  display: string;
}

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const PITCH_CLASS_BY_NAME: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const QUALITY_INTERVALS: Record<string, readonly number[]> = {
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

const QUALITY_SUFFIX: Record<string, string> = {
  major: "",
  minor: "m",
  dominant7: "7",
  major7: "maj7",
  minor7: "m7",
  major6: "6",
  minor6: "m6",
  add9: "add9",
  minorAdd9: "m(add9)",
  dominant9: "9",
  major9: "maj9",
  minor9: "m9",
  halfDiminished: "m7b5",
  sus2: "sus2",
  sus4: "sus4",
  diminished: "dim",
  augmented: "aug",
  power: "5",
};

const VOICINGS: Record<string, RawVoicing> = {
  C: { chord: "C", frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], name: "Open C" },
  "C/E": { chord: "C/E", frets: [0, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], name: "C over E" },
  D: { chord: "D", frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], name: "Open D" },
  Dm: {
    chord: "Dm",
    frets: [-1, -1, 0, 2, 3, 1],
    fingers: [0, 0, 0, 2, 3, 1],
    name: "Open D minor",
  },
  D7: { chord: "D7", frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], name: "Open D7" },
  Dm7b5: {
    chord: "Dm7♭5",
    frets: [-1, -1, 0, 1, 1, 1],
    fingers: [0, 0, 0, 1, 1, 1],
    name: "D half-diminished",
  },
  Eb: {
    chord: "E♭",
    frets: [-1, 6, 8, 8, 8, 6],
    fingers: [0, 1, 3, 3, 3, 1],
    name: "E-flat barre",
  },
  E: { chord: "E", frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], name: "Open E" },
  Em: { chord: "Em", frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], name: "Open E minor" },
  E7: { chord: "E7", frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], name: "Open E7" },
  F: { chord: "F", frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], name: "F barre" },
  Fm: {
    chord: "Fm",
    frets: [1, 3, 3, 1, 1, 1],
    fingers: [1, 3, 4, 1, 1, 1],
    name: "F minor barre",
  },
  G: { chord: "G", frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], name: "Open G" },
  "G/B": {
    chord: "G/B",
    frets: [-1, 2, 0, 0, 0, 3],
    fingers: [0, 1, 0, 0, 0, 3],
    name: "G over B",
  },
  Gm: {
    chord: "Gm",
    frets: [3, 5, 5, 3, 3, 3],
    fingers: [1, 3, 4, 1, 1, 1],
    name: "G minor barre",
  },
  Gsus4: {
    chord: "Gsus4",
    frets: [3, 3, 0, 0, 1, 3],
    fingers: [3, 2, 0, 0, 1, 4],
    name: "Open G suspended",
  },
  Ab: { chord: "A♭", frets: [4, 6, 6, 5, 4, 4], fingers: [1, 3, 4, 2, 1, 1], name: "A-flat barre" },
  A: { chord: "A", frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], name: "Open A" },
  Am: {
    chord: "Am",
    frets: [-1, 0, 2, 2, 1, 0],
    fingers: [0, 0, 2, 3, 1, 0],
    name: "Open A minor",
  },
  A7: { chord: "A7", frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], name: "Open A7" },
  Bb: {
    chord: "B♭",
    frets: [-1, 1, 3, 3, 3, 1],
    fingers: [0, 1, 3, 3, 3, 1],
    name: "B-flat barre",
  },
  B: { chord: "B", frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 3, 3, 3, 1], name: "B barre" },
  B7: { chord: "B7", frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], name: "Open B7" },
};

function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}

function normalizeChordName(chord: string): string {
  return chord.replaceAll("♭", "b").replaceAll("♯", "#").replaceAll("−", "m");
}

function parseGuitarChord(chord: string): ParsedGuitarChord {
  const normalized = normalizeChordName(chord);
  const [symbol, bassName] = normalized.split("/");
  const match = /^([A-G](?:#|b)?)(.*)$/.exec(symbol ?? "C");
  const rootName = match?.[1] ?? "C";
  const suffix = (match?.[2] ?? "").replaceAll("(", "").replaceAll(")", "");
  const root = PITCH_CLASS_BY_NAME[rootName] ?? 0;
  const bass = bassName ? PITCH_CLASS_BY_NAME[bassName] : undefined;
  let quality = "major";
  if (suffix.includes("m7b5")) quality = "halfDiminished";
  else if (suffix.includes("maj9")) quality = "major9";
  else if (suffix.includes("m9")) quality = "minor9";
  else if (suffix.includes("9")) quality = "dominant9";
  else if (suffix.includes("maj7")) quality = "major7";
  else if (suffix.includes("m7")) quality = "minor7";
  else if (suffix.includes("add9")) quality = suffix.startsWith("m") ? "minorAdd9" : "add9";
  else if (suffix === "m6" || suffix.includes("m6")) quality = "minor6";
  else if (suffix === "6" || suffix.includes("6")) quality = "major6";
  else if (suffix.includes("sus2")) quality = "sus2";
  else if (suffix.includes("sus4") || suffix === "sus") quality = "sus4";
  else if (suffix.includes("dim")) quality = "diminished";
  else if (suffix.includes("aug") || suffix === "+") quality = "augmented";
  else if (suffix === "5") quality = "power";
  else if (suffix === "m" || suffix.startsWith("m")) quality = "minor";
  const intervals = QUALITY_INTERVALS[quality] ?? QUALITY_INTERVALS.major;
  return { root, bass, quality, intervals, display: chord };
}

function canonicalChord(parsed: ParsedGuitarChord): string {
  const bass =
    parsed.bass !== undefined && parsed.bass !== parsed.root ? `/${PITCH_NAMES[parsed.bass]}` : "";
  return `${PITCH_NAMES[parsed.root]}${QUALITY_SUFFIX[parsed.quality] ?? ""}${bass}`;
}

function getTuning(id: GuitarTuningId = "standard"): GuitarTuning {
  return GUITAR_TUNINGS.find((tuning) => tuning.id === id) ?? GUITAR_TUNINGS[0]!;
}

function tuple(values: number[]): GuitarVoicing["frets"] {
  return values.slice(0, 6) as unknown as GuitarVoicing["frets"];
}

function assignFingers(frets: readonly GuitarFret[]): GuitarVoicing["fingers"] {
  const fingers = [0, 0, 0, 0, 0, 0];
  const groups = new Map<number, number[]>();
  frets.forEach((fret, index) => {
    if (fret > 0) groups.set(fret, [...(groups.get(fret) ?? []), index]);
  });
  let nextFinger = 1;
  [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([, strings]) => {
      const finger = Math.min(4, nextFinger);
      strings.forEach((index) => (fingers[index] = finger));
      if (strings.length < 2) nextFinger += 1;
      else nextFinger = Math.min(4, nextFinger + 1);
    });
  return tuple(fingers);
}

function decorateVoicing(
  raw: RawVoicing,
  parsed: ParsedGuitarChord,
  tuning: GuitarTuning,
  capo: number,
  sharedStrings?: number,
  voiceLeadingScore?: number,
): GuitarVoicing {
  const frets = raw.frets;
  const fretted = frets.filter((fret) => fret > 0);
  const minFret = fretted.length ? Math.min(...fretted) : 0;
  const maxFret = fretted.length ? Math.max(...fretted) : 0;
  const fretSpan = fretted.length ? maxFret - minFret + 1 : 0;
  const openStrings = frets.filter((fret) => fret === 0).length;
  const mutedStrings = frets.filter((fret) => fret < 0).length;
  const groups = new Map<number, number[]>();
  frets.forEach((fret, index) => {
    if (fret > 0) groups.set(fret, [...(groups.get(fret) ?? []), index]);
  });
  const barreFret = [...groups.entries()].find(([, strings]) => strings.length >= 2)?.[0];
  const fingers = raw.fingers ?? assignFingers(frets);
  const fingerCount = new Set(fingers.filter((finger) => finger > 0)).size;
  const difficulty = Math.max(
    1,
    Math.min(
      5,
      Math.round(
        1 +
          Math.max(0, fingerCount - 2) * 0.65 +
          Math.max(0, fretSpan - 3) * 0.45 +
          (barreFret ? 0.8 : 0) +
          (mutedStrings >= 2 ? 0.3 : 0),
      ),
    ),
  ) as GuitarVoicing["difficulty"];
  const style: GuitarVoicing["style"] =
    openStrings >= 2 && minFret <= 2
      ? "open"
      : barreFret
        ? "barre"
        : maxFret >= 8
          ? "high-neck"
          : mutedStrings >= 3
            ? "partial"
            : "movable";
  const id = `${canonicalChord(parsed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}-${tuning.id}-${capo}-${frets.join("-")}`;
  return {
    id,
    chord: raw.chord,
    frets: tuple([...frets]),
    fingers: tuple([...fingers]),
    name: raw.name,
    style,
    difficulty,
    fretSpan,
    minFret,
    maxFret,
    openStrings,
    mutedStrings,
    barreFret,
    sharedStrings,
    voiceLeadingScore,
  };
}

function transitionMetrics(
  previous: GuitarVoicing | readonly GuitarFret[] | undefined,
  next: readonly GuitarFret[],
): { sharedStrings: number; score: number } {
  if (!previous) return { sharedStrings: 0, score: 0 };
  const from = "frets" in previous ? previous.frets : previous;
  let distance = 0;
  let sharedStrings = 0;
  for (let index = 0; index < 6; index += 1) {
    const a = from[index] ?? -1;
    const b = next[index] ?? -1;
    if (a === b) sharedStrings += 1;
    if (a < 0 && b < 0) continue;
    if (a < 0 || b < 0) distance += 1.25;
    else distance += Math.abs(a - b);
  }
  return {
    sharedStrings,
    score: Math.max(0, Math.min(1, 1 - distance / 14)),
  };
}

function rawScore(
  frets: readonly GuitarFret[],
  parsed: ParsedGuitarChord,
  tuning: GuitarTuning,
  capo: number,
  windowStart: number,
): number | undefined {
  const sounding = frets.flatMap((fret, index) =>
    fret < 0 ? [] : [mod12(tuning.midi[index]! + capo + fret)],
  );
  const minimumNotes = parsed.intervals.length >= 4 ? 4 : 3;
  if (sounding.length < minimumNotes || !sounding.includes(parsed.root)) return undefined;
  const unique = [...new Set(sounding)];
  const covered = parsed.intervals.filter((interval) =>
    unique.includes(mod12(parsed.root + interval)),
  ).length;
  const requiredCoverage = parsed.intervals.length >= 5 ? 0.6 : 0.72;
  if (covered / parsed.intervals.length < requiredCoverage) return undefined;
  const firstIndex = frets.findIndex((fret) => fret >= 0);
  const bassPitch =
    firstIndex >= 0 ? mod12(tuning.midi[firstIndex]! + capo + frets[firstIndex]!) : undefined;
  if (parsed.bass !== undefined && bassPitch !== parsed.bass) return undefined;
  const fretted = frets.filter((fret) => fret > 0);
  const minFret = fretted.length ? Math.min(...fretted) : 0;
  const maxFret = fretted.length ? Math.max(...fretted) : 0;
  const span = fretted.length ? maxFret - minFret + 1 : 0;
  if (span > 5 || maxFret > 15) return undefined;
  const muted = frets.filter((fret) => fret < 0).length;
  const opens = frets.filter((fret) => fret === 0).length;
  const groups = new Map<number, number[]>();
  frets.forEach((fret, index) => {
    if (fret > 0) groups.set(fret, [...(groups.get(fret) ?? []), index]);
  });
  const barre = [...groups.values()].some((strings) => strings.length >= 2);
  const rootBassBonus = bassPitch === parsed.root ? 0.85 : 0;
  const coverageScore = covered / parsed.intervals.length;
  return (
    coverageScore * 4.1 +
    opens * 0.32 +
    rootBassBonus +
    (windowStart === 0 ? 0.75 : 0) -
    muted * 0.17 -
    span * 0.22 -
    maxFret * 0.035 -
    (barre ? 0.35 : 0)
  );
}

function generateVoicings(
  parsed: ParsedGuitarChord,
  tuning: GuitarTuning,
  capo: number,
  previous: GuitarVoicing | readonly GuitarFret[] | undefined,
): GuitarVoicing[] {
  const windows = [0, 1, 3, 5, 7, 9, 11];
  const candidates: { frets: number[]; score: number; window: number }[] = [];
  const targetPitchClasses = new Set(
    parsed.intervals.map((interval) => mod12(parsed.root + interval)),
  );

  for (const windowStart of windows) {
    const options = tuning.midi.map((base) => {
      const frets = [-1];
      const end = windowStart === 0 ? 4 : windowStart + 4;
      const start = windowStart === 0 ? 0 : windowStart;
      for (let fret = start; fret <= end; fret += 1) {
        if (targetPitchClasses.has(mod12(base + capo + fret))) frets.push(fret);
      }
      return [...new Set(frets)];
    });
    let visited = 0;
    const walk = (index: number, frets: number[]) => {
      if (visited >= 4_000) return;
      if (index === 6) {
        visited += 1;
        const score = rawScore(frets, parsed, tuning, capo, windowStart);
        if (score !== undefined) candidates.push({ frets, score, window: windowStart });
        return;
      }
      for (const fret of options[index]!) {
        walk(index + 1, [...frets, fret]);
        if (visited >= 4_000) return;
      }
    };
    walk(0, []);
  }

  const unique = new Map<string, { frets: number[]; score: number; window: number }>();
  candidates
    .sort((a, b) => b.score - a.score || a.frets.join(",").localeCompare(b.frets.join(",")))
    .forEach((candidate) => unique.set(candidate.frets.join(","), candidate));
  return [...unique.values()].slice(0, 18).map((candidate) => {
    const transition = transitionMetrics(previous, candidate.frets);
    const generatedName =
      candidate.window === 0 && parsed.intervals.length <= 3
        ? "open-position option"
        : candidate.window >= 8
          ? "high-neck option"
          : "movable option";
    return decorateVoicing(
      {
        chord: parsed.display,
        frets: tuple(candidate.frets),
        fingers: assignFingers(candidate.frets),
        name: generatedName,
      },
      parsed,
      tuning,
      capo,
      transition.sharedStrings,
      transition.score,
    );
  });
}

const voicingCache = new Map<string, GuitarVoicing[]>();

export function getGuitarTuning(id: GuitarTuningId = "standard"): GuitarTuning {
  return getTuning(id);
}

export function getGuitarVoicings(chord: string, query: GuitarVoicingQuery = {}): GuitarVoicing[] {
  const tuning = getTuning(query.tuning);
  const capo = Math.max(0, Math.min(12, query.capo ?? 0));
  const parsed = parseGuitarChord(chord);
  const previousKey =
    query.previous && "frets" in query.previous
      ? query.previous.frets.join(",")
      : (query.previous?.join(",") ?? "");
  const key = `${canonicalChord(parsed)}|${tuning.id}|${capo}|${previousKey}`;
  const cached = voicingCache.get(key);
  if (cached) return cached.slice(0, query.limit ?? 6);

  const generated = generateVoicings(parsed, tuning, capo, query.previous);
  const preset =
    query.tuning === undefined || query.tuning === "standard"
      ? VOICINGS[normalizeChordName(chord)]
      : undefined;
  const all: GuitarVoicing[] = [];
  const hasPreset = Boolean(
    preset && capo === 0 && rawScore(preset.frets, parsed, tuning, capo, 0) !== undefined,
  );
  if (hasPreset && preset) {
    const transition = transitionMetrics(query.previous, preset.frets);
    all.push(
      decorateVoicing(preset, parsed, tuning, capo, transition.sharedStrings, transition.score),
    );
  }
  for (const candidate of generated) {
    if (!all.some((item) => item.frets.join(",") === candidate.frets.join(",")))
      all.push(candidate);
  }
  const preservePreset = hasPreset && !query.previous;
  const firstPreset = preservePreset ? all[0] : undefined;
  const ranked = all.slice(preservePreset ? 1 : 0).sort((a, b) => {
    const transition = (b.voiceLeadingScore ?? 0) - (a.voiceLeadingScore ?? 0);
    if (query.previous && Math.abs(transition) > 0.01) return transition;
    return a.difficulty - b.difficulty || a.maxFret - b.maxFret || a.id.localeCompare(b.id);
  });
  all.splice(0, all.length, ...(firstPreset ? [firstPreset, ...ranked] : ranked));
  const result = all.slice(0, Math.max(1, query.limit ?? 6));
  voicingCache.set(key, all);
  return result;
}

export function createGuitarVoicing(
  chord: string,
  frets: readonly GuitarFret[],
  tuningId: GuitarTuningId = "standard",
  capo = 0,
  name = "Custom shape",
): GuitarVoicing {
  const parsed = parseGuitarChord(chord);
  const tuning = getTuning(tuningId);
  const safeFrets = tuple([...frets, -1, -1, -1, -1, -1]);
  return decorateVoicing(
    {
      chord,
      frets: safeFrets,
      fingers: assignFingers(safeFrets),
      name,
    },
    parsed,
    tuning,
    capo,
  );
}

export function getGuitarVoicing(chord: string, query: GuitarVoicingQuery = {}): GuitarVoicing {
  return getGuitarVoicings(chord, { ...query, limit: 1 })[0]!;
}

export function guitarVoicingNotes(chord: string, query: GuitarVoicingQuery = {}): string[] {
  return guitarNotesForVoicing(getGuitarVoicing(chord, query), query.tuning, query.capo);
}

export function guitarNotesForVoicing(
  voicing: GuitarVoicing,
  tuningId: GuitarTuningId = "standard",
  capo = 0,
): string[] {
  const tuning = getTuning(tuningId);
  return voicing.frets.flatMap((fret, stringIndex) => {
    if (fret < 0) return [];
    const midi = tuning.midi[stringIndex]! + capo + fret;
    return [`${PITCH_NAMES[mod12(midi)]}${Math.floor(midi / 12) - 1}`];
  });
}

export function guitarDiagramWindow(
  chordOrVoicing: string | GuitarVoicing,
  query: GuitarVoicingQuery = {},
): { firstFret: number; fretCount: number } {
  const voicing =
    typeof chordOrVoicing === "string" ? getGuitarVoicing(chordOrVoicing, query) : chordOrVoicing;
  const firstFret = voicing.maxFret <= 5 ? 1 : Math.max(1, voicing.minFret);
  return { firstFret, fretCount: 5 };
}

export function getChordColorVariants(chord: string): ChordColorVariant[] {
  const parsed = parseGuitarChord(chord);
  const root = PITCH_NAMES[parsed.root];
  if (parsed.quality === "minor" || parsed.quality === "minor7") {
    return [
      {
        chord: `${root}m7`,
        label: "More open",
        description: "Adds a soft seventh while keeping the minor pull.",
      },
      {
        chord: `${root}m(add9)`,
        label: "More spacious",
        description: "Adds air and a little unresolved color.",
      },
      {
        chord: `${root}m6`,
        label: "Vintage",
        description: "A warm, slightly unexpected lift inside the minor sound.",
      },
      {
        chord: `${root}m/${PITCH_NAMES[mod12(parsed.root + 3)]}`,
        label: "Try an inversion",
        description: "Keep the chord tones and let the bass line travel.",
      },
    ];
  }
  return [
    {
      chord: `${root}add9`,
      label: "Brighter",
      description: "Keeps the major center and adds a ringing upper color.",
    },
    {
      chord: `${root}maj7`,
      label: "More intimate",
      description: "Softens the arrival with a wistful major seventh.",
    },
    {
      chord: `${root}6`,
      label: "Warm lift",
      description: "Adds a soulful, settled color without extra tension.",
    },
    {
      chord: `${root}sus2`,
      label: "More open",
      description: "Removes the third for a floating, unresolved shape.",
    },
    {
      chord: `${root}/${PITCH_NAMES[mod12(parsed.root + 4)]}`,
      label: "Bass movement",
      description: "Keep the chord tones and let the bass line travel.",
    },
  ];
}

const ANALYZABLE_QUALITIES = [
  "major",
  "minor",
  "dominant7",
  "major7",
  "minor7",
  "major6",
  "minor6",
  "add9",
  "minorAdd9",
  "dominant9",
  "major9",
  "minor9",
  "halfDiminished",
  "sus2",
  "sus4",
  "diminished",
  "augmented",
  "power",
] as const;

const INTERVAL_LABELS: Record<number, string> = {
  0: "root",
  1: "♭2",
  2: "2 / 9",
  3: "♭3",
  4: "3",
  5: "4 / 11",
  6: "♭5",
  7: "5",
  8: "♯5",
  9: "6 / 13",
  10: "♭7",
  11: "7",
};

export function analyzeFretShape(
  frets: readonly GuitarFret[],
  tuningId: GuitarTuningId = "standard",
  capo = 0,
): FretShapeMatch[] {
  const tuning = getTuning(tuningId);
  const pitches = frets.flatMap((fret, index) =>
    fret < 0 ? [] : [mod12(tuning.midi[index]! + capo + fret)],
  );
  if (pitches.length < 2) return [];
  const uniquePitches = [...new Set(pitches)];
  const bass = pitches[0];
  return ANALYZABLE_QUALITIES.flatMap((quality) =>
    Array.from({ length: 12 }, (_, root) => {
      const intervals = QUALITY_INTERVALS[quality];
      const tones = new Set(intervals.map((interval) => mod12(root + interval)));
      const covered = uniquePitches.filter((pitch) => tones.has(pitch)).length;
      const extras = uniquePitches.filter((pitch) => !tones.has(pitch)).length;
      if (!tones.has(root) || covered < Math.min(2, tones.size) || extras > 1) return undefined;
      const coverage = covered / Math.min(tones.size, uniquePitches.length);
      const confidence = Math.max(
        0,
        Math.min(0.99, coverage * 0.78 + (bass === root ? 0.16 : 0) - extras * 0.1),
      );
      const chord = `${PITCH_NAMES[root]}${QUALITY_SUFFIX[quality] ?? ""}${bass !== root ? `/${PITCH_NAMES[bass!]}` : ""}`;
      const intervalsFound = uniquePitches
        .map((pitch) => INTERVAL_LABELS[mod12(pitch - root)] ?? "tone")
        .slice(0, 6);
      return {
        chord,
        confidence,
        intervals: intervalsFound,
        detail: `${intervalsFound.join(" · ")}${bass !== root ? ` · bass ${PITCH_NAMES[bass!]}` : ""}`,
      } satisfies FretShapeMatch;
    }),
  )
    .filter((match): match is FretShapeMatch => Boolean(match))
    .sort((a, b) => b.confidence - a.confidence || a.chord.localeCompare(b.chord))
    .slice(0, 6);
}
