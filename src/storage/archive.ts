import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { songDocumentSchema, type SongDocument } from "@/types/music";

import {
  exportDataSchema,
  exportManifestSchema,
  type AppSettings,
  type Discovery,
  type ExportData,
  type ExportManifest,
  type ImportResult,
} from "./schemas";

export const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
export const MAX_EXPANDED_BYTES = 50 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 64;

const allowedTextFiles = new Set(["manifest.json", "data.json"]);
const recordingNamePattern =
  /^recordings\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:webm|ogg|wav)$/i;

interface ArchiveEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
}

function validateSongReferences(songs: SongDocument[]): void {
  const songIds = new Set<string>();
  for (const song of songs) {
    if (songIds.has(song.id)) {
      throw new Error(`Archive contains duplicate song ID: ${song.id}.`);
    }
    songIds.add(song.id);

    const versionIds = new Set<string>();
    const nestedIds = new Set<string>();
    for (const version of song.versions) {
      if (versionIds.has(version.id)) {
        throw new Error(`Song "${song.title}" contains duplicate versions.`);
      }
      versionIds.add(version.id);
      for (const section of version.sections) {
        if (nestedIds.has(section.id)) {
          throw new Error(`Song "${song.title}" contains duplicate section IDs.`);
        }
        nestedIds.add(section.id);
        for (const block of section.chords) {
          if (nestedIds.has(block.id)) {
            throw new Error(`Song "${song.title}" contains duplicate chord IDs.`);
          }
          nestedIds.add(block.id);
        }
      }
    }
    if (!versionIds.has(song.activeVersionId)) {
      throw new Error(`Song "${song.title}" points to a missing active version.`);
    }
  }
}

function readUInt16(data: Uint8Array, offset: number): number {
  return data[offset]! | (data[offset + 1]! << 8);
}

function readUInt32(data: Uint8Array, offset: number): number {
  return (
    (data[offset]! |
      (data[offset + 1]! << 8) |
      (data[offset + 2]! << 16) |
      (data[offset + 3]! << 24)) >>>
    0
  );
}

function decodeFilename(data: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(data);
}

function isSafeArchivePath(name: string): boolean {
  if (
    name.length === 0 ||
    name.length > 180 ||
    name.includes("\\") ||
    name.startsWith("/") ||
    /^[a-z]:/i.test(name)
  ) {
    return false;
  }
  const segments = name.split("/");
  return !segments.some((segment) => segment === "" || segment === "." || segment === "..");
}

export function inspectZipArchive(data: Uint8Array): ArchiveEntry[] {
  if (data.byteLength === 0 || data.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error("Archive is empty or exceeds the 25 MB import limit.");
  }

  const eocdMinimum = 22;
  const searchStart = Math.max(0, data.length - (65_535 + eocdMinimum));
  let eocd = -1;
  for (let offset = data.length - eocdMinimum; offset >= searchStart; offset -= 1) {
    if (readUInt32(data, offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("This file is not a valid Harmonic Compass archive.");
  }

  const diskNumber = readUInt16(data, eocd + 4);
  const directoryDisk = readUInt16(data, eocd + 6);
  const entryCount = readUInt16(data, eocd + 10);
  const directorySize = readUInt32(data, eocd + 12);
  const directoryOffset = readUInt32(data, eocd + 16);
  if (diskNumber !== 0 || directoryDisk !== 0) {
    throw new Error("Multi-part ZIP archives are not supported.");
  }
  if (entryCount === 0 || entryCount > MAX_ARCHIVE_ENTRIES) {
    throw new Error("Archive contains an unsupported number of files.");
  }
  if (directoryOffset + directorySize > data.length) {
    throw new Error("Archive directory is incomplete.");
  }

  const entries: ArchiveEntry[] = [];
  const names = new Set<string>();
  let cursor = directoryOffset;
  let expandedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(data, cursor) !== 0x02014b50) {
      throw new Error("Archive directory is malformed.");
    }
    const flags = readUInt16(data, cursor + 8);
    const compressedSize = readUInt32(data, cursor + 20);
    const uncompressedSize = readUInt32(data, cursor + 24);
    const filenameLength = readUInt16(data, cursor + 28);
    const extraLength = readUInt16(data, cursor + 30);
    const commentLength = readUInt16(data, cursor + 32);
    const filenameStart = cursor + 46;
    const filenameEnd = filenameStart + filenameLength;

    if ((flags & 0x1) !== 0) {
      throw new Error("Encrypted ZIP archives are not supported.");
    }
    if (filenameEnd > data.length) {
      throw new Error("Archive filename is incomplete.");
    }
    const name = decodeFilename(data.subarray(filenameStart, filenameEnd));
    if (
      !isSafeArchivePath(name) ||
      (!allowedTextFiles.has(name) && !recordingNamePattern.test(name))
    ) {
      throw new Error(`Archive contains an unsupported path: ${name || "(empty)"}.`);
    }
    if (names.has(name)) {
      throw new Error(`Archive contains a duplicate path: ${name}.`);
    }
    names.add(name);

    expandedBytes += uncompressedSize;
    if (
      uncompressedSize > MAX_ARCHIVE_BYTES ||
      expandedBytes > MAX_EXPANDED_BYTES ||
      compressedSize > MAX_ARCHIVE_BYTES
    ) {
      throw new Error("Archive expands beyond the safe import limit.");
    }

    entries.push({ name, compressedSize, uncompressedSize });
    cursor = filenameEnd + extraLength + commentLength;
    if (cursor > directoryOffset + directorySize) {
      throw new Error("Archive directory is malformed.");
    }
  }

  if (!names.has("manifest.json") || !names.has("data.json")) {
    throw new Error("Archive is missing its manifest or song data.");
  }
  return entries;
}

export interface ExportArchiveInput {
  songs: SongDocument[];
  settings?: AppSettings;
  discoveries?: Discovery[];
  recordings?: ReadonlyMap<string, Uint8Array>;
  appVersion?: string;
  exportedAt?: string;
}

export function createExportArchive(input: ExportArchiveInput): Uint8Array {
  const data: ExportData = exportDataSchema.parse({
    songs: input.songs,
    settings: input.settings,
    discoveries: input.discoveries ?? [],
  });
  const recordings = input.recordings ?? new Map<string, Uint8Array>();
  validateSongReferences(data.songs);

  for (const [name, bytes] of recordings) {
    if (!recordingNamePattern.test(name)) {
      throw new Error(`Unsafe recording path: ${name}.`);
    }
    if (bytes.byteLength > MAX_ARCHIVE_BYTES) {
      throw new Error(`Recording exceeds the per-file export limit: ${name}.`);
    }
  }

  const manifest: ExportManifest = exportManifestSchema.parse({
    format: "harmonic-compass",
    schemaVersion: 1,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    appVersion: input.appVersion ?? "1.0.0",
    songCount: data.songs.length,
    includesSettings: Boolean(data.settings),
    includesRecordings: recordings.size > 0,
  });
  const files: Record<string, Uint8Array> = {
    "manifest.json": strToU8(JSON.stringify(manifest)),
    "data.json": strToU8(JSON.stringify(data)),
  };
  for (const [name, bytes] of recordings) {
    files[name] = bytes;
  }

  const archive = zipSync(files, { level: 6 });
  if (archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error("Export exceeds the 25 MB archive limit.");
  }
  return archive;
}

function parseJsonFile(value: Uint8Array | undefined, name: string): unknown {
  if (!value) {
    throw new Error(`Archive is missing ${name}.`);
  }
  try {
    return JSON.parse(strFromU8(value));
  } catch {
    throw new Error(`${name} contains invalid JSON.`);
  }
}

export function readImportArchive(archive: Uint8Array): ImportResult {
  const entries = inspectZipArchive(archive);
  const files = unzipSync(archive);
  const manifest = exportManifestSchema.parse(
    parseJsonFile(files["manifest.json"], "manifest.json"),
  );
  const data = exportDataSchema.parse(parseJsonFile(files["data.json"], "data.json"));
  validateSongReferences(data.songs);

  if (manifest.songCount !== data.songs.length) {
    throw new Error("Archive manifest does not match its song data.");
  }
  if (manifest.includesSettings !== Boolean(data.settings)) {
    throw new Error("Archive settings declaration is inconsistent.");
  }

  const recordingFiles = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (recordingNamePattern.test(entry.name)) {
      const bytes = files[entry.name];
      if (!bytes || bytes.byteLength !== entry.uncompressedSize) {
        throw new Error(`Recording is incomplete: ${entry.name}.`);
      }
      recordingFiles.set(entry.name, bytes);
    }
  }
  if (manifest.includesRecordings !== recordingFiles.size > 0) {
    throw new Error("Archive recording declaration is inconsistent.");
  }

  return {
    songs: data.songs.map((song) => songDocumentSchema.parse(song)),
    settings: data.settings,
    discoveries: data.discoveries,
    recordingFiles,
  };
}

export function archiveFilename(date = new Date()): string {
  return `harmonic-compass-${date.toISOString().slice(0, 10)}.hcompass.zip`;
}
