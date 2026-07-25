import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { createExportArchive, inspectZipArchive, readImportArchive } from "@/storage/archive";
import { createSeedData } from "@/storage/seeds";

describe("Harmonic Compass archive", () => {
  it("round-trips validated songs and settings", () => {
    const seeds = createSeedData("2026-07-25T06:00:00.000Z");
    const archive = createExportArchive({
      songs: seeds.songs,
      settings: seeds.settings,
      discoveries: seeds.discoveries,
      exportedAt: "2026-07-25T06:00:00.000Z",
    });
    const restored = readImportArchive(archive);

    expect(restored.songs.map((song) => song.title)).toEqual([
      "Borrowed Light",
      "Open Road",
      "Blue Hour",
    ]);
    expect(restored.settings?.recordOriginalAudio).toBe(false);
    expect(restored.discoveries).toHaveLength(3);
  });

  it("rejects traversal paths before decompression", () => {
    const malicious = zipSync({
      "manifest.json": strToU8("{}"),
      "data.json": strToU8("{}"),
      "../library.json": strToU8("{}"),
    });

    expect(() => inspectZipArchive(malicious)).toThrow(/unsupported path/i);
  });

  it("rejects a manifest that disagrees with its data", () => {
    const manifest = {
      format: "harmonic-compass",
      schemaVersion: 1,
      exportedAt: "2026-07-25T06:00:00.000Z",
      appVersion: "1.0.0",
      songCount: 1,
      includesSettings: false,
      includesRecordings: false,
    };
    const archive = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "data.json": strToU8(JSON.stringify({ songs: [], discoveries: [] })),
    });

    expect(() => readImportArchive(archive)).toThrow(/manifest/i);
  });
});
