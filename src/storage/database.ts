"use client";

import Dexie, { type EntityTable } from "dexie";

import { songDocumentSchema, type SongDocument } from "@/types/music";

import { createSeedData } from "./seeds";
import {
  appSettingsSchema,
  type AppSettings,
  type ChallengeAttempt,
  type Discovery,
  type PlayerEvidence,
  type SettingsPatch,
  type Take,
} from "./schemas";
import { pruneAutomaticVersions } from "./versions";

export const DATABASE_NAME = "harmonic-compass";

export class HarmonicCompassDatabase extends Dexie {
  songs!: EntityTable<SongDocument, "id">;
  settings!: EntityTable<AppSettings, "id">;
  takes!: EntityTable<Take, "id">;
  discoveries!: EntityTable<Discovery, "id">;
  challengeAttempts!: EntityTable<ChallengeAttempt, "id">;
  playerEvidence!: EntityTable<PlayerEvidence, "id">;

  constructor(name = DATABASE_NAME) {
    super(name);

    this.version(1).stores({
      songs: "id, updatedAt, status, title, *tags",
      settings: "id, updatedAt",
      takes: "id, songId, createdAt, updatedAt",
      discoveries: "id, favorite, updatedAt, title",
      challengeAttempts: "id, challengeId, songId, completedAt",
      playerEvidence: "id, concept, lastObservedAt",
    });
  }
}

let database: HarmonicCompassDatabase | undefined;

export function getDatabase(): HarmonicCompassDatabase {
  if (typeof indexedDB === "undefined") {
    throw new Error("Harmonic Compass storage is only available in the browser.");
  }
  database ??= new HarmonicCompassDatabase();
  return database;
}

export async function ensureSeeded(target = getDatabase()): Promise<{ seeded: boolean }> {
  return target.transaction("rw", target.songs, target.settings, target.discoveries, async () => {
    const hasSettings = await target.settings.get("primary");
    const songCount = await target.songs.count();
    if (hasSettings || songCount > 0) {
      return { seeded: false };
    }

    const seeds = createSeedData();
    await Promise.all([
      target.songs.bulkPut(seeds.songs),
      target.settings.put(seeds.settings),
      target.discoveries.bulkPut(seeds.discoveries),
    ]);
    return { seeded: true };
  });
}

/**
 * Initialize a real user database without inserting showcase/example content.
 * The showcase seed path remains available for deterministic demo tooling,
 * while a cold user starts with an empty personal library.
 */
export async function ensureInitialized(
  target = getDatabase(),
): Promise<{ initialized: boolean }> {
  return target.transaction("rw", target.settings, async () => {
    const hasSettings = await target.settings.get("primary");
    if (hasSettings) return { initialized: false };

    const now = new Date().toISOString();
    const seeds = createSeedData(now);
    await target.settings.put(seeds.settings);
    return { initialized: true };
  });
}

export async function saveSong(song: SongDocument, target = getDatabase()): Promise<SongDocument> {
  const parsed = songDocumentSchema.parse({
    ...song,
    versions: pruneAutomaticVersions(song.versions, song.activeVersionId),
    updatedAt: new Date().toISOString(),
  });
  await target.songs.put(parsed);
  return parsed;
}

export async function getSettings(target = getDatabase()): Promise<AppSettings> {
  await ensureInitialized(target);
  const settings = await target.settings.get("primary");
  return appSettingsSchema.parse(settings);
}

export async function updateSettings(
  patch: SettingsPatch,
  target = getDatabase(),
): Promise<AppSettings> {
  const current = await getSettings(target);
  const next = appSettingsSchema.parse({
    ...current,
    ...patch,
    id: "primary",
    schemaVersion: 1,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await target.settings.put(next);
  return next;
}

export async function deleteSong(id: string, target = getDatabase()): Promise<void> {
  await target.transaction("rw", target.songs, target.takes, async () => {
    await target.takes.where("songId").equals(id).modify({ songId: undefined });
    await target.songs.delete(id);
  });
}
