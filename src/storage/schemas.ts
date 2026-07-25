import { z } from "zod";

import {
  chordSymbolSchema,
  songDocumentSchema,
  stableChordEventSchema,
  type AssistanceLevel,
  type SongDocument,
} from "@/types/music";

export const STORAGE_SCHEMA_VERSION = 1 as const;

export const appSettingsSchema = z.object({
  id: z.literal("primary"),
  schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  assistanceLevel: z.enum(["beginner", "developing", "advanced"]),
  capo: z.number().int().min(0).max(7),
  recordOriginalAudio: z.boolean(),
  bandEnabled: z.boolean(),
  bandStyle: z.enum(["campfire", "open-road", "night-air"]),
  bandDensity: z.enum(["minimal", "steady", "full"]),
  appearance: z.enum(["system", "dark"]),
  onboardingComplete: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const takeSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  songId: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(120),
  durationMs: z
    .number()
    .nonnegative()
    .max(4 * 60 * 60 * 1000),
  chordEvents: z.array(stableChordEventSchema).max(4096),
  audioBlob: z.instanceof(Blob).optional(),
  audioMimeType: z.string().max(100).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Take = z.infer<typeof takeSchema>;

export const discoverySchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  chords: z.array(chordSymbolSchema).min(1).max(16),
  favorite: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Discovery = z.infer<typeof discoverySchema>;

export const challengeAttemptSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  challengeId: z.string().trim().min(1).max(100),
  songId: z.string().uuid().optional(),
  score: z.number().min(0).max(1),
  hintsUsed: z.number().int().nonnegative().max(10),
  completedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ChallengeAttempt = z.infer<typeof challengeAttemptSchema>;

export const playerEvidenceSchema = z.object({
  id: z.string().trim().min(1).max(100),
  schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  concept: z.string().trim().min(1).max(100),
  successes: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  lastObservedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PlayerEvidence = z.infer<typeof playerEvidenceSchema>;

export const exportManifestSchema = z.object({
  format: z.literal("harmonic-compass"),
  schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  exportedAt: z.string().datetime(),
  appVersion: z.string().trim().min(1).max(40),
  songCount: z.number().int().nonnegative().max(5000),
  includesSettings: z.boolean(),
  includesRecordings: z.boolean(),
});

export type ExportManifest = z.infer<typeof exportManifestSchema>;

export const exportDataSchema = z.object({
  songs: z.array(songDocumentSchema).max(5000),
  settings: appSettingsSchema.optional(),
  discoveries: z.array(discoverySchema).max(5000).default([]),
});

export type ExportData = z.infer<typeof exportDataSchema>;

export interface ImportResult {
  songs: SongDocument[];
  settings?: AppSettings;
  discoveries: Discovery[];
  recordingFiles: Map<string, Uint8Array>;
}

export interface SeedDefinition {
  songs: SongDocument[];
  settings: AppSettings;
  discoveries: Discovery[];
}

export type SettingsPatch = Partial<
  Pick<
    AppSettings,
    | "assistanceLevel"
    | "capo"
    | "recordOriginalAudio"
    | "bandEnabled"
    | "bandStyle"
    | "bandDensity"
    | "appearance"
    | "onboardingComplete"
  >
>;

export const assistanceLevels: readonly AssistanceLevel[] = [
  "beginner",
  "developing",
  "advanced",
] as const;
