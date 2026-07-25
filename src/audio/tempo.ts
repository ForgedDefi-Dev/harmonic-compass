import type { TempoContext } from "@/types/music";

export function estimateTempo(onsetsMs: number[]): TempoContext {
  const recent = onsetsMs.slice(-24);
  if (recent.length < 4) {
    return { confidence: 0, source: "detected", locked: false };
  }

  const intervals = recent
    .slice(1)
    .map((value, index) => value - recent[index])
    .filter((interval) => interval >= 180 && interval <= 2000)
    .map((interval) => {
      let bpm = 60_000 / interval;
      while (bpm < 70) bpm *= 2;
      while (bpm > 175) bpm /= 2;
      return bpm;
    });
  if (intervals.length < 3) {
    return { confidence: 0.1, source: "detected", locked: false };
  }

  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  const deviations = intervals.map((value) => Math.abs(value - median));
  const meanDeviation = deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
  const confidence = Math.max(
    0.15,
    Math.min(0.92, (1 - meanDeviation / Math.max(1, median * 0.22)) * (intervals.length / 9)),
  );
  return {
    bpm: Math.round(median),
    confidence,
    source: "detected",
    locked: false,
  };
}

export function tempoFromTaps(tapsMs: number[]): TempoContext {
  const result = estimateTempo(tapsMs.slice(-4));
  return {
    ...result,
    source: "tap",
    locked: result.bpm !== undefined,
    confidence: result.bpm ? Math.max(0.72, result.confidence) : result.confidence,
  };
}
