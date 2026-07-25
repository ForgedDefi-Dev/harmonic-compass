import { describe, expect, it } from "vitest";

import { createLocalCoachResponse, formatChord } from "@/lib/mentor/coach";
import { validateAiMentorResponse } from "@/lib/mentor/validate";
import type { MentorRequest } from "@/types/music";

const request: MentorRequest = {
  schemaVersion: 1,
  question: "How can I make this turn darker?",
  intent: "darken",
  context: {
    currentChord: { root: 5, quality: "major" },
    key: { tonic: 0, mode: "major", confidence: 0.9 },
    progression: [
      { root: 0, quality: "major" },
      { root: 5, quality: "major" },
    ],
    assistanceLevel: "beginner",
    allowedSuggestions: [
      {
        id: "borrowed-iv",
        target: { root: 5, quality: "minor" },
        route: [
          { root: 5, quality: "minor" },
          { root: 0, quality: "major" },
        ],
        bearing: "shadow",
        functionLabel: "borrowed minor iv",
        emotionTags: ["darker", "intimate"],
        tension: 0.55,
        novelty: 0.7,
        playability: 0.8,
        voiceLeading: 0.9,
        explanation: "the borrowed minor iv shades the return to the tonic.",
      },
    ],
  },
};

describe("local Compass Coach", () => {
  it("returns an actionable, schema-valid fallback", () => {
    const response = createLocalCoachResponse(request);

    expect(response.mode).toBe("local");
    expect(response.answer).toContain("Fm → C");
    expect(response.actions[0]?.suggestionId).toBe("borrowed-iv");
  });

  it("formats chord qualities and slash bass notes", () => {
    expect(formatChord({ root: 10, quality: "major7", bass: 2 })).toBe("B♭maj7/D");
  });

  it("rejects model actions that are not engine-approved", () => {
    const response = validateAiMentorResponse(
      {
        answer: "Try this route.",
        actions: [
          {
            label: "Preview",
            type: "preview",
            suggestionId: "invented-id",
          },
        ],
        theoryTerms: [],
      },
      request,
    );

    expect(response).toBeUndefined();
  });
});
