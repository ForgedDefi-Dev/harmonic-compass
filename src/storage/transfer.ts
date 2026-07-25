"use client";

import type { SongDocument } from "@/types/music";

import { createExportArchive, readImportArchive } from "./archive";
import { getDatabase, type HarmonicCompassDatabase } from "./database";

export async function exportLibrary(
  target: HarmonicCompassDatabase = getDatabase(),
): Promise<Uint8Array> {
  const [songs, settings, discoveries] = await Promise.all([
    target.songs.toArray(),
    target.settings.get("primary"),
    target.discoveries.toArray(),
  ]);
  return createExportArchive({ songs, settings, discoveries });
}

export async function importLibrary(
  bytes: Uint8Array,
  options: { overwrite?: boolean } = {},
  target: HarmonicCompassDatabase = getDatabase(),
): Promise<{ importedSongs: number; skippedSongs: number }> {
  const imported = readImportArchive(bytes);
  let importedSongs = 0;
  let skippedSongs = 0;

  await target.transaction("rw", target.songs, target.settings, target.discoveries, async () => {
    const songsToWrite: SongDocument[] = [];
    for (const song of imported.songs) {
      const existing = await target.songs.get(song.id);
      if (existing && !options.overwrite) {
        skippedSongs += 1;
      } else {
        songsToWrite.push(song);
      }
    }
    if (songsToWrite.length > 0) {
      await target.songs.bulkPut(songsToWrite);
    }
    importedSongs = songsToWrite.length;

    if (imported.settings && options.overwrite) {
      await target.settings.put(imported.settings);
    }
    if (imported.discoveries.length > 0) {
      if (options.overwrite) {
        await target.discoveries.bulkPut(imported.discoveries);
      } else {
        for (const discovery of imported.discoveries) {
          if (!(await target.discoveries.get(discovery.id))) {
            await target.discoveries.put(discovery);
          }
        }
      }
    }
  });

  return { importedSongs, skippedSongs };
}
