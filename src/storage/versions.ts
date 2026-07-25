import type { SongDocument, SongVersion } from "@/types/music";

export const AUTO_VERSION_PREFIX = "Auto · ";
export const MAX_AUTO_VERSIONS = 20;

export function isAutomaticVersion(version: SongVersion): boolean {
  return version.label.startsWith(AUTO_VERSION_PREFIX);
}

export function pruneAutomaticVersions(
  versions: SongVersion[],
  activeVersionId?: string,
): SongVersion[] {
  const automatic = versions
    .filter(isAutomaticVersion)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const keepAutomaticIds = new Set(
    automatic.slice(0, MAX_AUTO_VERSIONS).map((version) => version.id),
  );

  if (activeVersionId) {
    keepAutomaticIds.add(activeVersionId);
  }

  return versions.filter(
    (version) => !isAutomaticVersion(version) || keepAutomaticIds.has(version.id),
  );
}

export function addVersion(
  song: SongDocument,
  version: SongVersion,
  options: { activate?: boolean } = {},
): SongDocument {
  const activeVersionId = options.activate === false ? song.activeVersionId : version.id;
  return {
    ...song,
    activeVersionId,
    versions: pruneAutomaticVersions([...song.versions, version], activeVersionId),
    updatedAt: new Date().toISOString(),
  };
}
