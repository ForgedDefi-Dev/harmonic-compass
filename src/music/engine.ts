import type {
  ChordQuality,
  ChordSymbol,
  EmotionalIntent,
  HarmonicSuggestion,
  TonalContext,
} from "@/types/music";
import {
  formatChord,
  guitarPlayability,
  mod12,
  romanNumeral,
  scaleChords,
  sameChord,
  voiceLeadingScore,
} from "./theory";

type Bearing = HarmonicSuggestion["bearing"];

interface Candidate {
  chord: ChordSymbol;
  bearing: Bearing;
  explanation: string;
  emotions: string[];
  tension: number;
  novelty: number;
}

const PURPOSES: Record<number, Omit<Candidate, "chord">> = {
  0: {
    bearing: "resolve",
    explanation: "Returns to the tonal center and lets the phrase land.",
    emotions: ["settled", "grounded"],
    tension: 0.08,
    novelty: 0.05,
  },
  1: {
    bearing: "flow",
    explanation: "Continues the motion with a gentle setup chord.",
    emotions: ["moving", "open"],
    tension: 0.35,
    novelty: 0.18,
  },
  2: {
    bearing: "lift",
    explanation: "Changes the color while keeping a strong connection to home.",
    emotions: ["bright", "expansive"],
    tension: 0.27,
    novelty: 0.15,
  },
  3: {
    bearing: "lift",
    explanation: "Opens the harmony and creates a natural place to keep building.",
    emotions: ["open", "hopeful"],
    tension: 0.3,
    novelty: 0.1,
  },
  4: {
    bearing: "tension",
    explanation: "Builds a clear pull toward home.",
    emotions: ["urgent", "expectant"],
    tension: 0.84,
    novelty: 0.08,
  },
  5: {
    bearing: "shadow",
    explanation: "Turns inward without leaving the key.",
    emotions: ["intimate", "reflective"],
    tension: 0.24,
    novelty: 0.12,
  },
  6: {
    bearing: "tension",
    explanation: "Creates a fragile, unresolved pull into the next chord.",
    emotions: ["restless", "unresolved"],
    tension: 0.91,
    novelty: 0.32,
  },
};

function contextualCandidates(
  current: ChordSymbol,
  key: NonNullable<TonalContext["primary"]>,
): Candidate[] {
  const scale = scaleChords(key.tonic, key.mode);
  const basic = scale.map((chord, degree) => ({
    chord,
    ...PURPOSES[degree],
  }));

  const minorFourth: ChordSymbol = {
    root: mod12(key.tonic + 5),
    quality: "minor",
  };
  const secondaryDominant: ChordSymbol = {
    root: mod12(key.tonic + 2),
    quality: "dominant7",
  };
  const flatSeven: ChordSymbol = {
    root: mod12(key.tonic + 10),
    quality: "major",
  };
  const extras: Candidate[] = [
    {
      chord: minorFourth,
      bearing: "shadow",
      explanation: "Borrows the minor iv color for a darker turn that still wants to come home.",
      emotions: ["bittersweet", "cinematic"],
      tension: 0.55,
      novelty: 0.72,
    },
    {
      chord: secondaryDominant,
      bearing: "surprise",
      explanation: "Temporarily spotlights the dominant with a bright, decisive push.",
      emotions: ["bold", "energetic"],
      tension: 0.76,
      novelty: 0.68,
    },
    {
      chord: flatSeven,
      bearing: "surprise",
      explanation: "Borrows a broad, rootsy color from the parallel mode.",
      emotions: ["anthemic", "unexpected"],
      tension: 0.48,
      novelty: 0.76,
    },
  ];
  return [...basic, ...extras].filter((item) => !sameChord(item.chord, current));
}

const INTENT_BEARINGS: Record<EmotionalIntent, Bearing[]> = {
  hopeful: ["lift", "resolve", "flow"],
  intimate: ["shadow", "flow", "resolve"],
  energetic: ["tension", "lift", "surprise"],
  tense: ["tension", "surprise", "flow"],
  mysterious: ["surprise", "shadow", "tension"],
  melancholic: ["shadow", "flow", "surprise"],
  triumphant: ["tension", "lift", "resolve"],
  unresolved: ["tension", "flow", "surprise"],
  home: ["resolve", "flow", "lift"],
  surprise: ["surprise", "shadow", "tension"],
};

export function getSuggestions(
  current: ChordSymbol,
  key: TonalContext["primary"],
  intent?: EmotionalIntent,
  limit = 6,
): HarmonicSuggestion[] {
  if (!key) {
    key = {
      tonic: current.root,
      mode: current.quality === "minor" || current.quality === "minor7" ? "minor" : "major",
      confidence: 0.35,
    };
  }
  const preferred = intent ? INTENT_BEARINGS[intent] : [];
  const candidates = contextualCandidates(current, key);

  return candidates
    .map((candidate) => {
      const purposeRank = preferred.indexOf(candidate.bearing);
      const intentBoost = purposeRank < 0 ? 0 : (3 - purposeRank) * 0.13;
      const voiceLeading = voiceLeadingScore(current, candidate.chord);
      const playability = guitarPlayability(candidate.chord);
      const rank =
        intentBoost +
        voiceLeading * 0.31 +
        playability * 0.2 +
        (1 - candidate.novelty) * 0.08 +
        (candidate.bearing === "resolve" ? 0.07 : 0);
      return {
        suggestion: {
          id: `${formatChord(current)}-${formatChord(candidate.chord)}-${candidate.bearing}`
            .toLowerCase()
            .replaceAll("♯", "s")
            .replaceAll("♭", "b")
            .replaceAll(/[^a-z0-9-]/g, ""),
          target: candidate.chord,
          route: [candidate.chord],
          bearing: candidate.bearing,
          functionLabel: romanNumeral(candidate.chord, key),
          emotionTags: candidate.emotions,
          tension: candidate.tension,
          novelty: candidate.novelty,
          playability,
          voiceLeading,
          explanation: candidate.explanation,
        } satisfies HarmonicSuggestion,
        rank,
      };
    })
    .sort((a, b) => b.rank - a.rank || a.suggestion.id.localeCompare(b.suggestion.id))
    .slice(0, limit)
    .map(({ suggestion }) => suggestion);
}

function chord(root: number, quality: ChordQuality): ChordSymbol {
  return { root: mod12(root), quality };
}

export interface EmotionalRoute {
  id: "direct" | "build" | "twist";
  label: "Direct" | "Build" | "Twist";
  description: string;
  chords: ChordSymbol[];
}

export function getEmotionalRoutes(
  current: ChordSymbol,
  key: NonNullable<TonalContext["primary"]>,
  intent: EmotionalIntent,
): EmotionalRoute[] {
  const t = key.tonic;
  const homeQuality: ChordQuality = key.mode === "minor" ? "minor" : "major";
  const home = chord(t, homeQuality);
  const fourth = chord(t + 5, key.mode === "major" ? "major" : "minor");
  const fifth = chord(t + 7, "major");
  const relative = chord(
    t + (key.mode === "major" ? 9 : 3),
    key.mode === "major" ? "minor" : "major",
  );
  const ii = chord(t + 2, "minor");
  const minorFourth = chord(t + 5, "minor");
  const flatSeven = chord(t + 10, "major");

  const destination =
    intent === "home" || intent === "triumphant" || intent === "hopeful"
      ? home
      : intent === "intimate" || intent === "melancholic"
        ? relative
        : intent === "tense" || intent === "unresolved"
          ? fifth
          : fourth;

  const routes: EmotionalRoute[] = [
    {
      id: "direct",
      label: "Direct",
      description: "The clearest route to the feeling.",
      chords: sameChord(current, destination)
        ? [current, fourth, destination]
        : [current, destination],
    },
    {
      id: "build",
      label: "Build",
      description: "Adds momentum before the destination.",
      chords: [current, intent === "tense" ? ii : fourth, fifth, destination],
    },
    {
      id: "twist",
      label: "Twist",
      description: "Uses one borrowed color for a less predictable arrival.",
      chords: [
        current,
        intent === "mysterious" || intent === "surprise" ? flatSeven : minorFourth,
        destination,
      ],
    },
  ];

  return routes.map((route) => ({
    ...route,
    chords: route.chords.filter(
      (item, index, items) => index === 0 || !sameChord(item, items[index - 1]),
    ),
  })) as EmotionalRoute[];
}

export function explainMovement(
  from: ChordSymbol,
  to: ChordSymbol,
  key: TonalContext["primary"],
): string {
  const target = getSuggestions(from, key, undefined, 10).find((item) =>
    sameChord(item.target, to),
  );
  if (target) return target.explanation;
  return `${formatChord(to, key)} changes the harmonic color while preserving shared tones with ${formatChord(from, key)}.`;
}
