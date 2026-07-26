import { describe, expect, it } from "vitest";

import { STEEL_STRING_SAMPLE_ROOTS, noteToMidi } from "@/audio/steel-string-sampler";

describe("steel-string sample bank", () => {
  it("maps guitar notes to the MIDI numbers used by Web Audio", () => {
    expect(noteToMidi("E2")).toBe(40);
    expect(noteToMidi("D#3")).toBe(51);
    expect(noteToMidi("Bb3")).toBe(58);
    expect(noteToMidi("not-a-note")).toBeUndefined();
  });

  it("covers the playable steel-string register with recorded roots", () => {
    expect(STEEL_STRING_SAMPLE_ROOTS[0]?.midi).toBe(40);
    expect(STEEL_STRING_SAMPLE_ROOTS.at(-1)?.midi).toBe(84);
    expect(STEEL_STRING_SAMPLE_ROOTS).toHaveLength(13);
  });
});
