export type GuitarFret = number;

export interface GuitarVoicing {
  chord: string;
  frets: readonly [GuitarFret, GuitarFret, GuitarFret, GuitarFret, GuitarFret, GuitarFret];
  fingers: readonly [GuitarFret, GuitarFret, GuitarFret, GuitarFret, GuitarFret, GuitarFret];
  name: string;
}

const STANDARD_TUNING_MIDI = [40, 45, 50, 55, 59, 64] as const;
const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const VOICINGS: Record<string, GuitarVoicing> = {
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

function normalizeChordName(chord: string): string {
  return chord.replaceAll("♭", "b").replaceAll("♯", "#");
}

function pitchClass(name: string): number {
  const roots: Record<string, number> = {
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
  return roots[name] ?? 0;
}

function generatedBarreVoicing(chord: string): GuitarVoicing {
  const normalized = normalizeChordName(chord);
  const symbol = normalized.split("/")[0] ?? "C";
  const match = /^([A-G](?:#|b)?)(.*)$/.exec(symbol);
  const rootName = match?.[1] ?? "C";
  const suffix = match?.[2] ?? "";
  const root = pitchClass(rootName);
  const eFret = (root - 4 + 12) % 12;
  const aFret = (root - 9 + 12) % 12;
  const useAShape = aFret > 0 && (eFret === 0 || aFret < eFret);
  const isMinor = suffix.startsWith("m") && !suffix.startsWith("maj");
  const isSeventh = suffix.includes("7");

  let frets: GuitarVoicing["frets"];
  if (useAShape) {
    frets = isMinor
      ? [-1, aFret, aFret + 2, isSeventh ? aFret : aFret + 2, aFret + 1, aFret]
      : [-1, aFret, aFret + 2, isSeventh ? aFret : aFret + 2, aFret + 2, aFret];
  } else {
    frets = isMinor
      ? [eFret, eFret + 2, eFret + 2, eFret, eFret, eFret]
      : [eFret, eFret + 2, isSeventh ? eFret : eFret + 2, eFret + 1, eFret, eFret];
  }
  return {
    chord,
    frets,
    fingers: frets.map((fret, index) =>
      fret <= 0 ? 0 : index === 0 || index === 5 ? 1 : 3,
    ) as unknown as GuitarVoicing["fingers"],
    name: `${chord} movable shape`,
  };
}

export function getGuitarVoicing(chord: string): GuitarVoicing {
  const normalized = normalizeChordName(chord);
  return VOICINGS[normalized] ?? generatedBarreVoicing(chord);
}

export function guitarVoicingNotes(chord: string): string[] {
  const voicing = getGuitarVoicing(chord);
  return voicing.frets.flatMap((fret, stringIndex) => {
    if (fret < 0) return [];
    const midi = STANDARD_TUNING_MIDI[stringIndex] + fret;
    const note = PITCH_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return [`${note}${octave}`];
  });
}

export function guitarDiagramWindow(chord: string): { firstFret: number; fretCount: number } {
  const fretted = getGuitarVoicing(chord).frets.filter((fret) => fret > 0);
  const minimum = fretted.length > 0 ? Math.min(...fretted) : 1;
  const maximum = fretted.length > 0 ? Math.max(...fretted) : 4;
  const firstFret = maximum <= 5 ? 1 : minimum;
  return { firstFret, fretCount: 5 };
}
