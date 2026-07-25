import type {
  ChordBlock,
  ChordQuality,
  ChordSymbol,
  SongDocument,
  SongSection,
  SongVersion,
} from "@/types/music";

import { STORAGE_SCHEMA_VERSION, type Discovery, type SeedDefinition } from "./schemas";

const SEEDED_AT = "2026-07-25T06:00:00.000Z";

const ids = {
  borrowedLight: "2ea7220d-a9b7-43dc-96e6-e99c5a28b700",
  openRoad: "b56b3ff1-3a44-48dc-8ce0-226cab21e904",
  blueHour: "9c2d9b37-f914-4ff6-a653-51a1a6b19572",
  discoveryCadence: "0684e85e-d2bd-49f6-98d0-2936237e5226",
  discoveryBorrowed: "fa2a80d4-408e-4917-9f11-1ea317c22f65",
  discoveryJazz: "b8cf6b0b-eea6-4a74-8f10-f60937f797d2",
} as const;

function chord(root: number, quality: ChordQuality = "major"): ChordSymbol {
  return { root, quality };
}

function block(id: string, value: ChordSymbol, beats = 4): ChordBlock {
  return { id, chord: value, beats, confidence: 1 };
}

function seedUuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

function seededSong(
  id: string,
  idOffset: number,
  title: string,
  bpm: number,
  tonic: number,
  mode: "major" | "minor",
  chordValues: ChordSymbol[],
  tag: string,
): SongDocument {
  const sectionId = seedUuid(idOffset);
  const versionId = seedUuid(idOffset + 1);
  const section: SongSection = {
    id: sectionId,
    name: "First idea",
    type: "idea",
    chords: chordValues.map((value, index) => block(seedUuid(idOffset + 2 + index), value)),
  };
  const version: SongVersion = {
    id: versionId,
    label: "Original",
    createdAt: SEEDED_AT,
    sections: [section],
  };

  return {
    id,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    title,
    status: "idea",
    bpm,
    key: {
      primary: { tonic, mode, confidence: 0.96 },
      alternatives: [],
      locked: false,
    },
    activeVersionId: versionId,
    versions: [version],
    tags: ["example", tag],
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  };
}

export function createSeedData(now = new Date().toISOString()): SeedDefinition {
  const songs = [
    seededSong(
      ids.borrowedLight,
      100,
      "Borrowed Light",
      96,
      0,
      "major",
      [chord(0), chord(7), chord(9, "minor"), chord(5), chord(5, "minor"), chord(0)],
      "borrowed-harmony",
    ),
    seededSong(
      ids.openRoad,
      200,
      "Open Road",
      108,
      7,
      "major",
      [chord(7), chord(2), chord(4, "minor"), chord(0)],
      "bright",
    ),
    seededSong(
      ids.blueHour,
      300,
      "Blue Hour",
      82,
      9,
      "minor",
      [chord(9, "minor"), chord(5), chord(0), chord(7)],
      "intimate",
    ),
  ];

  const discoveries: Discovery[] = [
    {
      id: ids.discoveryCadence,
      schemaVersion: STORAGE_SCHEMA_VERSION,
      title: "The pull home",
      description: "V → I creates the clearest feeling of arrival.",
      chords: [chord(7), chord(0)],
      favorite: true,
      createdAt: SEEDED_AT,
      updatedAt: SEEDED_AT,
    },
    {
      id: ids.discoveryBorrowed,
      schemaVersion: STORAGE_SCHEMA_VERSION,
      title: "The borrowed shadow",
      description: "IV → iv → I darkens the path just before home.",
      chords: [chord(5), chord(5, "minor"), chord(0)],
      favorite: true,
      createdAt: SEEDED_AT,
      updatedAt: SEEDED_AT,
    },
    {
      id: ids.discoveryJazz,
      schemaVersion: STORAGE_SCHEMA_VERSION,
      title: "A longer runway",
      description: "ii → V → I builds momentum before resolving.",
      chords: [chord(2, "minor"), chord(7, "dominant7"), chord(0)],
      favorite: false,
      createdAt: SEEDED_AT,
      updatedAt: SEEDED_AT,
    },
  ];

  return {
    songs,
    discoveries,
    settings: {
      id: "primary",
      schemaVersion: STORAGE_SCHEMA_VERSION,
      assistanceLevel: "beginner",
      capo: 0,
      recordOriginalAudio: false,
      bandEnabled: false,
      bandStyle: "campfire",
      bandDensity: "minimal",
      appearance: "dark",
      onboardingComplete: false,
      createdAt: now,
      updatedAt: now,
    },
  };
}

export const seedSongIds = ids;
