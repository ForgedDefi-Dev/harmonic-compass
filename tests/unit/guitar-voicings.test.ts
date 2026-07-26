import { describe, expect, it } from "vitest";

import {
  analyzeFretShape,
  getChordColorVariants,
  getGuitarVoicing,
  getGuitarVoicings,
  guitarDiagramWindow,
  guitarVoicingNotes,
} from "@/music";

describe("guitar voicings", () => {
  it("uses familiar open-position shapes for core songwriter chords", () => {
    expect(getGuitarVoicing("C").frets).toEqual([-1, 3, 2, 0, 1, 0]);
    expect(getGuitarVoicing("G").frets).toEqual([3, 2, 0, 0, 0, 3]);
    expect(getGuitarVoicing("Am").frets).toEqual([-1, 0, 2, 2, 1, 0]);
    expect(getGuitarVoicing("Dm").frets).toEqual([-1, -1, 0, 2, 3, 1]);
  });

  it("turns the physical fretboard shape into low-to-high guitar notes", () => {
    expect(guitarVoicingNotes("C")).toEqual(["C3", "E3", "G3", "C4", "E4"]);
    expect(guitarVoicingNotes("F")).toEqual(["F2", "C3", "F3", "A3", "C4", "F4"]);
    expect(guitarVoicingNotes("G/B")[0]).toBe("B2");
  });

  it("supports borrowed, altered, slash, and movable shapes shown by the product", () => {
    for (const chord of ["Fm", "D7", "E7", "A7", "B♭", "A♭", "E♭", "Dm7♭5", "Gsus4"]) {
      const voicing = getGuitarVoicing(chord);
      expect(voicing.frets).toHaveLength(6);
      expect(guitarVoicingNotes(chord).length).toBeGreaterThanOrEqual(4);
    }
    expect(guitarDiagramWindow("E♭").firstFret).toBe(6);
  });

  it("generates a playable fallback instead of showing the same incorrect diagram", () => {
    const voicing = getGuitarVoicing("F#m7");
    expect(voicing.chord).toBe("F#m7");
    expect(voicing.name).toContain("movable");
    expect(guitarVoicingNotes("F#m7").length).toBeGreaterThanOrEqual(5);
  });

  it("generates multiple accurate shapes for extended chords", () => {
    const voicings = getGuitarVoicings("Cmaj7", { limit: 4 });
    expect(voicings.length).toBeGreaterThanOrEqual(2);
    expect(voicings.every((voicing) => Boolean(voicing.frets))).toBe(true);
    expect(new Set(voicings.map((voicing) => voicing.frets.join(","))).size).toBe(voicings.length);
  });

  it("ranks a next chord by physical voice leading", () => {
    const current = getGuitarVoicing("C");
    const next = getGuitarVoicings("G", { previous: current, limit: 4 });
    expect(next[0]?.voiceLeadingScore).toBeGreaterThanOrEqual(next.at(-1)?.voiceLeadingScore ?? 0);
    expect(next[0]?.sharedStrings).toBeGreaterThan(0);
  });

  it("names a tapped fret shape and exposes color variants", () => {
    const matches = analyzeFretShape([-1, 3, 2, 0, 1, 0]);
    expect(matches[0]?.chord).toBe("C");
    expect(getChordColorVariants("C").map((variant) => variant.chord)).toContain("Cadd9");
  });
});
