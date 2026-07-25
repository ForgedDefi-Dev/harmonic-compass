import { describe, expect, it } from "vitest";
import type { ChordSymbol, StableChordEvent } from "@/types/music";
import {
  SHOWCASE_PROGRESSION,
  createShowcaseEvents,
  formatChord,
  getEmotionalRoutes,
  getSuggestions,
  inferKey,
  mod12,
  romanNumeral,
  scaleChords,
  voiceLeadingScore,
} from "@/music";

describe("music theory", () => {
  it("builds all transpositions of a major scale without escaping pitch classes", () => {
    for (let tonic = 0; tonic < 12; tonic += 1) {
      const scale = scaleChords(tonic as never, "major");
      expect(scale).toHaveLength(7);
      expect(scale[0]).toEqual({ root: tonic, quality: "major" });
      expect(scale.every((item) => item.root >= 0 && item.root <= 11)).toBe(true);
    }
    expect(mod12(-1)).toBe(11);
  });

  it("formats chord qualities, slash chords, and contextual flats", () => {
    expect(formatChord({ root: 1, quality: "minor7" })).toBe("C♯m7");
    expect(
      formatChord(
        { root: 10, quality: "major", bass: 2 },
        { tonic: 5, mode: "major", confidence: 1 },
      ),
    ).toBe("B♭/D");
  });

  it("reports diatonic function and borrowed harmony", () => {
    const key = { tonic: 0 as const, mode: "major" as const, confidence: 0.9 };
    expect(romanNumeral({ root: 7, quality: "dominant7" }, key)).toBe("V7");
    expect(romanNumeral({ root: 5, quality: "minor" }, key)).toBe("iv");
    expect(romanNumeral({ root: 1, quality: "major" }, key)).toBe("borrowed");
  });

  it("rewards smooth voice leading", () => {
    const c: ChordSymbol = { root: 0, quality: "major" };
    expect(voiceLeadingScore(c, { root: 9, quality: "minor" })).toBeGreaterThan(
      voiceLeadingScore(c, { root: 1, quality: "major" }),
    );
  });
});

describe("key inference", () => {
  it("finds C major from the showcase progression while preserving uncertainty", () => {
    const context = inferKey(createShowcaseEvents());
    expect(context.primary?.tonic).toBe(0);
    expect(context.primary?.mode).toBe("major");
    expect(context.primary?.confidence).toBeGreaterThan(0.55);
    expect(context.locked).toBe(false);
  });

  it("does not announce a key after one chord", () => {
    expect(inferKey(createShowcaseEvents().slice(0, 1)).primary).toBeUndefined();
  });

  it("honors an explicit key lock", () => {
    const locked = { tonic: 2 as const, mode: "minor" as const, confidence: 1 };
    expect(inferKey([], locked)).toEqual({
      primary: locked,
      alternatives: [],
      locked: true,
    });
  });

  it("does not let one borrowed chord erase the tonal center", () => {
    const events = createShowcaseEvents();
    const borrowed: StableChordEvent = {
      ...events[0],
      id: "00000000-0000-4000-8000-999999999999",
      startMs: 20_000,
      endMs: 22_000,
      primary: { chord: { root: 5, quality: "minor" }, confidence: 0.98 },
    };
    const context = inferKey([...events.slice(0, 4), borrowed, events[5]]);
    expect(context.primary).toMatchObject({ tonic: 0, mode: "major" });
  });
});

describe("harmonic navigation", () => {
  const key = { tonic: 0 as const, mode: "major" as const, confidence: 0.9 };
  const current: ChordSymbol = { root: 9, quality: "minor" };

  it("returns deterministic purpose-rich suggestions", () => {
    const suggestions = getSuggestions(current, key);
    expect(suggestions).toHaveLength(6);
    expect(new Set(suggestions.map((item) => item.bearing)).size).toBeGreaterThan(2);
    expect(suggestions.every((item) => item.route.length >= 1)).toBe(true);
    expect(suggestions.every((item) => item.playability >= 0 && item.playability <= 1)).toBe(true);
    expect(getSuggestions(current, key)).toEqual(suggestions);
  });

  it("prioritizes resolution when the player asks to go home", () => {
    const suggestions = getSuggestions(current, key, "home");
    expect(suggestions[0].bearing).toBe("resolve");
    expect(suggestions[0].target).toEqual({ root: 0, quality: "major" });
  });

  it("provides exactly Direct, Build, and Twist routes of bounded length", () => {
    const routes = getEmotionalRoutes(current, key, "triumphant");
    expect(routes.map((route) => route.label)).toEqual(["Direct", "Build", "Twist"]);
    expect(routes.every((route) => route.chords.length >= 2 && route.chords.length <= 4)).toBe(
      true,
    );
    expect(routes[2].chords).toContainEqual({ root: 5, quality: "minor" });
  });

  it("keeps the checked-in showcase progression stable", () => {
    expect(SHOWCASE_PROGRESSION.map((item) => formatChord(item))).toEqual([
      "C",
      "G",
      "Am",
      "F",
      "Fm",
      "C",
    ]);
  });
});
