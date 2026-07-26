import { describe, expect, it } from "vitest";

import { STEEL_STRING_PROFILE, synthesizeSteelString } from "@/audio/playback";

function rms(samples: Float32Array, start: number, end: number): number {
  let sum = 0;
  const boundedEnd = Math.min(end, samples.length);
  for (let index = start; index < boundedEnd; index += 1) sum += samples[index] ** 2;
  return Math.sqrt(sum / Math.max(1, boundedEnd - start));
}

describe("warm steel-string playback model", () => {
  it("is deterministic, bounded, and naturally decays", () => {
    const first = synthesizeSteelString(48_000, 110, 1.2, 2);
    const second = synthesizeSteelString(48_000, 110, 1.2, 2);

    expect(first.length).toBe(57_600);
    expect(Array.from(first.slice(0, 64))).toEqual(Array.from(second.slice(0, 64)));
    expect(Math.abs(first[0])).toBe(0);
    expect(first[12]).not.toBe(0);

    let peak = 0;
    for (const sample of first) peak = Math.max(peak, Math.abs(sample));
    expect(peak).toBeLessThanOrEqual(0.620001);
    expect(rms(first, 24_000, 36_000)).toBeLessThan(rms(first, 960, 1_920));
  });

  it("keeps the acoustic body contribution subtle", () => {
    expect(STEEL_STRING_PROFILE.bodyMix).toBeGreaterThan(0.02);
    expect(STEEL_STRING_PROFILE.bodyMix).toBeLessThan(0.08);
    expect(STEEL_STRING_PROFILE.pickAttackSeconds).toBeLessThan(0.015);
  });
});
