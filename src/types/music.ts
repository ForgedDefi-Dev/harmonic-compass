import { z } from "zod";

export const pitchClassSchema = z.number().int().min(0).max(11);
export type PitchClass = z.infer<typeof pitchClassSchema>;

export const chordQualitySchema = z.enum([
  "major",
  "minor",
  "dominant7",
  "major7",
  "minor7",
  "sus2",
  "sus4",
  "diminished",
  "augmented",
  "power",
]);
export type ChordQuality = z.infer<typeof chordQualitySchema>;

export const chordSymbolSchema = z.object({
  root: pitchClassSchema,
  quality: chordQualitySchema,
  bass: pitchClassSchema.optional(),
});
export type ChordSymbol = z.infer<typeof chordSymbolSchema>;

export const chordCandidateSchema = z.object({
  chord: chordSymbolSchema,
  confidence: z.number().min(0).max(1),
});
export type ChordCandidate = z.infer<typeof chordCandidateSchema>;

export const chordSourceSchema = z.enum(["microphone", "manual", "demo"]);
export type ChordSource = z.infer<typeof chordSourceSchema>;

export const stableChordEventSchema = z.object({
  id: z.string().uuid(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative().optional(),
  primary: chordCandidateSchema,
  alternatives: z.array(chordCandidateSchema).max(1).default([]),
  confidenceBand: z.enum(["high", "medium", "low"]),
  status: z.enum(["provisional", "confirmed", "corrected"]),
  source: chordSourceSchema,
});
export type StableChordEvent = z.infer<typeof stableChordEventSchema>;

export const tonalContextSchema = z.object({
  primary: z
    .object({
      tonic: pitchClassSchema,
      mode: z.enum(["major", "minor"]),
      confidence: z.number().min(0).max(1),
    })
    .optional(),
  alternatives: z
    .array(
      z.object({
        tonic: pitchClassSchema,
        mode: z.enum(["major", "minor"]),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(2)
    .default([]),
  locked: z.boolean().default(false),
});
export type TonalContext = z.infer<typeof tonalContextSchema>;

export const tempoContextSchema = z.object({
  bpm: z.number().min(40).max(240).optional(),
  confidence: z.number().min(0).max(1),
  source: z.enum(["detected", "tap", "manual"]),
  locked: z.boolean(),
});
export type TempoContext = z.infer<typeof tempoContextSchema>;

export const harmonicSuggestionSchema = z.object({
  id: z.string(),
  target: chordSymbolSchema,
  route: z.array(chordSymbolSchema).min(1).max(4),
  bearing: z.enum(["resolve", "lift", "tension", "shadow", "surprise", "flow"]),
  functionLabel: z.string(),
  emotionTags: z.array(z.string()).max(4),
  tension: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
  playability: z.number().min(0).max(1),
  voiceLeading: z.number().min(0).max(1),
  explanation: z.string(),
});
export type HarmonicSuggestion = z.infer<typeof harmonicSuggestionSchema>;

export const sectionTypeSchema = z.enum([
  "intro",
  "verse",
  "pre-chorus",
  "chorus",
  "bridge",
  "outro",
  "idea",
]);
export type SectionType = z.infer<typeof sectionTypeSchema>;

export const chordBlockSchema = z.object({
  id: z.string().uuid(),
  chord: chordSymbolSchema,
  beats: z.number().positive().max(32),
  sourceMs: z.number().nonnegative().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type ChordBlock = z.infer<typeof chordBlockSchema>;

export const songSectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  type: sectionTypeSchema,
  chords: z.array(chordBlockSchema).max(256),
});
export type SongSection = z.infer<typeof songSectionSchema>;

export const songVersionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(80),
  createdAt: z.string().datetime(),
  sections: z.array(songSectionSchema).max(64),
});
export type SongVersion = z.infer<typeof songVersionSchema>;

export const songDocumentSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(1),
  title: z.string().min(1).max(120),
  status: z.enum(["idea", "song"]),
  bpm: z.number().min(40).max(240),
  key: tonalContextSchema.optional(),
  activeVersionId: z.string().uuid(),
  versions: z.array(songVersionSchema).min(1),
  tags: z.array(z.string()).max(12).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SongDocument = z.infer<typeof songDocumentSchema>;

export const mentorRequestSchema = z.object({
  schemaVersion: z.literal(1),
  question: z.string().trim().min(1).max(600),
  intent: z.enum(["explain", "contrast", "darken", "simplify", "teach"]),
  context: z.object({
    currentChord: chordSymbolSchema.optional(),
    key: tonalContextSchema.shape.primary.optional(),
    progression: z.array(chordSymbolSchema).max(32),
    sectionType: sectionTypeSchema.optional(),
    assistanceLevel: z.enum(["beginner", "developing", "advanced"]),
    allowedSuggestions: z.array(harmonicSuggestionSchema).max(8),
  }),
});
export type MentorRequest = z.infer<typeof mentorRequestSchema>;

export const mentorResponseSchema = z.object({
  answer: z.string().max(1000),
  insight: z.string().max(400).optional(),
  actions: z
    .array(
      z.object({
        label: z.string().max(80),
        type: z.enum(["preview", "focus-suggestion", "open-diagram", "start-challenge"]),
        suggestionId: z.string().optional(),
      }),
    )
    .max(3),
  theoryTerms: z.array(z.string().max(80)).max(6),
  mode: z.enum(["ai", "local"]),
});
export type MentorResponse = z.infer<typeof mentorResponseSchema>;

export type AssistanceLevel = "beginner" | "developing" | "advanced";
export type EmotionalIntent =
  | "hopeful"
  | "intimate"
  | "energetic"
  | "tense"
  | "mysterious"
  | "melancholic"
  | "triumphant"
  | "unresolved"
  | "home"
  | "surprise";
