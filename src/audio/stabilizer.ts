import type { ChordCandidate, StableChordEvent } from "@/types/music";
import { sameChord } from "@/music/theory";

export interface ChordObservation {
  atMs: number;
  rms: number;
  onset: boolean;
  tuningCents: number;
  primary?: ChordCandidate;
  alternative?: ChordCandidate;
}

export interface StabilizerUpdate {
  provisional?: StableChordEvent;
  confirmed?: StableChordEvent;
  completed?: StableChordEvent;
}

function eventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `00000000-0000-4000-8000-${Math.floor(Math.random() * 1e12)
    .toString()
    .padStart(12, "0")}`;
}

export class ChordStabilizer {
  private candidate?: {
    chord: ChordCandidate;
    alternative?: ChordCandidate;
    firstAt: number;
    lastAt: number;
    observations: number;
  };
  private active?: StableChordEvent;

  push(observation: ChordObservation): StabilizerUpdate {
    if (!observation.primary || observation.primary.confidence < 0.38) {
      this.candidate = undefined;
      return {};
    }

    if (!this.candidate || !sameChord(this.candidate.chord.chord, observation.primary.chord)) {
      this.candidate = {
        chord: observation.primary,
        alternative: observation.alternative,
        firstAt: observation.atMs,
        lastAt: observation.atMs,
        observations: 1,
      };
      return { provisional: this.makeEvent(this.candidate, "provisional") };
    }

    this.candidate.lastAt = observation.atMs;
    this.candidate.observations += 1;
    if (observation.primary.confidence > this.candidate.chord.confidence) {
      this.candidate.chord = observation.primary;
      this.candidate.alternative = observation.alternative;
    }

    const stableFor = this.candidate.lastAt - this.candidate.firstAt;
    if (
      this.candidate.observations >= 3 &&
      stableFor >= 120 &&
      (!this.active || !sameChord(this.active.primary.chord, observation.primary.chord))
    ) {
      const completed = this.active ? { ...this.active, endMs: this.candidate.firstAt } : undefined;
      this.active = this.makeEvent(this.candidate, "confirmed");
      return { confirmed: this.active, completed };
    }
    return {};
  }

  finish(atMs: number): StableChordEvent | undefined {
    const result = this.active ? { ...this.active, endMs: atMs } : undefined;
    this.active = undefined;
    this.candidate = undefined;
    return result;
  }

  reset(): void {
    this.active = undefined;
    this.candidate = undefined;
  }

  private makeEvent(
    candidate: NonNullable<ChordStabilizer["candidate"]>,
    status: "provisional" | "confirmed",
  ): StableChordEvent {
    const confidence = candidate.chord.confidence;
    return {
      id: eventId(),
      startMs: candidate.firstAt,
      primary: candidate.chord,
      alternatives: candidate.alternative ? [candidate.alternative] : [],
      confidenceBand: confidence >= 0.78 ? "high" : confidence >= 0.55 ? "medium" : "low",
      status,
      source: "microphone",
    };
  }
}
