import { describe, expect, it } from "vitest";

import type { SongVersion } from "@/types/music";
import { AUTO_VERSION_PREFIX, pruneAutomaticVersions } from "@/storage/versions";

function version(index: number, automatic = true): SongVersion {
  return {
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    label: automatic ? `${AUTO_VERSION_PREFIX}${index}` : `Named ${index}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    sections: [],
  };
}

describe("automatic song versions", () => {
  it("retains twenty autos while preserving every named version", () => {
    const versions = [
      ...Array.from({ length: 25 }, (_, index) => version(index)),
      version(100, false),
      version(101, false),
    ];
    const result = pruneAutomaticVersions(versions);

    expect(result.filter((item) => item.label.startsWith(AUTO_VERSION_PREFIX))).toHaveLength(20);
    expect(result.filter((item) => item.label.startsWith("Named"))).toHaveLength(2);
    expect(result.some((item) => item.label === `${AUTO_VERSION_PREFIX}24`)).toBe(true);
  });
});
