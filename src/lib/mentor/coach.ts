import {
  mentorRequestSchema,
  mentorResponseSchema,
  type ChordQuality,
  type ChordSymbol,
  type HarmonicSuggestion,
  type MentorRequest,
  type MentorResponse,
} from "@/types/music";

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

const qualitySuffix: Record<ChordQuality, string> = {
  major: "",
  minor: "m",
  dominant7: "7",
  major7: "maj7",
  minor7: "m7",
  major6: "6",
  minor6: "m6",
  add9: "add9",
  minorAdd9: "m(add9)",
  dominant9: "9",
  major9: "maj9",
  minor9: "m9",
  halfDiminished: "m7b5",
  sus2: "sus2",
  sus4: "sus4",
  diminished: "dim",
  augmented: "aug",
  power: "5",
};

export function formatChord(chord: ChordSymbol): string {
  const root = NOTE_NAMES[chord.root] ?? "?";
  const suffix = qualitySuffix[chord.quality];
  const bass = chord.bass === undefined ? "" : `/${NOTE_NAMES[chord.bass] ?? "?"}`;
  return `${root}${suffix}${bass}`;
}

function suggestionRoute(suggestion: HarmonicSuggestion): string {
  return suggestion.route.map(formatChord).join(" → ");
}

function insightForSuggestion(suggestion: HarmonicSuggestion): string {
  if (suggestion.bearing === "resolve") {
    return "Resolution feels convincing because tension drops as the harmony returns to a stable center.";
  }
  if (suggestion.bearing === "shadow") {
    return "The darker color comes from changing the chord quality while keeping a familiar harmonic landmark.";
  }
  if (suggestion.bearing === "tension") {
    return "Tension is useful when it points somewhere—let the unstable sound create appetite for the next chord.";
  }
  if (suggestion.bearing === "surprise") {
    return "The surprise works because one unusual move is framed by chords the ear already understands.";
  }
  if (suggestion.bearing === "lift") {
    return "Lift comes from moving toward brighter, more open harmonic territory without losing the tonal center.";
  }
  return "Smooth shared tones make the change feel connected even when the chord name changes.";
}

function pickSuggestion(request: MentorRequest): HarmonicSuggestion | undefined {
  const suggestions = request.context.allowedSuggestions;
  const preferredBearing: HarmonicSuggestion["bearing"] | undefined =
    request.intent === "darken"
      ? "shadow"
      : request.intent === "contrast"
        ? "surprise"
        : request.intent === "simplify"
          ? "flow"
          : undefined;
  return (
    suggestions.find((suggestion) => suggestion.bearing === preferredBearing) ?? suggestions[0]
  );
}

function theoryTermsFor(suggestion?: HarmonicSuggestion): string[] {
  if (!suggestion) return ["harmonic function"];
  const terms = [suggestion.functionLabel.slice(0, 80)];
  if (suggestion.bearing === "resolve") terms.push("resolution");
  if (suggestion.bearing === "shadow") terms.push("modal interchange");
  if (suggestion.bearing === "tension") terms.push("harmonic tension");
  if (suggestion.voiceLeading >= 0.75) terms.push("voice leading");
  return [...new Set(terms.filter(Boolean))].slice(0, 6);
}

export function createLocalCoachResponse(input: MentorRequest): MentorResponse {
  const request = mentorRequestSchema.parse(input);
  const suggestion = pickSuggestion(request);
  const progression =
    request.context.progression.length > 0
      ? request.context.progression.map(formatChord).join(" → ")
      : "the idea you are playing";

  if (!suggestion) {
    return mentorResponseSchema.parse({
      answer: `Listen for where ${progression} feels settled and where it still feels in motion. Play the loop once more, then hold the final chord for two extra beats. That contrast will tell your ear whether the idea has arrived.`,
      insight:
        "Harmony becomes intuitive when you compare the physical feeling of motion with the feeling of arrival.",
      actions: [],
      theoryTerms: ["harmonic function"],
      mode: "local",
    });
  }

  const route = suggestionRoute(suggestion);
  const explanation = suggestion.explanation.trim().slice(0, 600);
  const current = request.context.currentChord
    ? formatChord(request.context.currentChord)
    : "your current chord";
  const intentLead: Record<MentorRequest["intent"], string> = {
    explain: `From ${current}, this route works because ${explanation}`,
    contrast: `For a clearer contrast, try ${route}. ${explanation}`,
    darken: `To turn the color inward, try ${route}. ${explanation}`,
    simplify: `Keep the movement direct with ${route}. ${explanation}`,
    teach: `Play ${route} slowly and notice what changes after ${current}. ${explanation}`,
  };

  return mentorResponseSchema.parse({
    answer: intentLead[request.intent],
    insight: insightForSuggestion(suggestion),
    actions: [
      {
        label: `Preview ${route}`,
        type: "preview",
        suggestionId: suggestion.id,
      },
      {
        label: "Show this path",
        type: "focus-suggestion",
        suggestionId: suggestion.id,
      },
    ],
    theoryTerms: theoryTermsFor(suggestion),
    mode: "local",
  });
}
