import type { MentorRequest } from "@/types/music";

import { formatChord } from "./coach";

export const MENTOR_INSTRUCTIONS = `You are Compass Coach, a concise guitar harmony mentor.
Work only from the supplied symbolic musical context. Never claim to have heard audio.
The guitarist remains the author: explain and offer a small experiment, never write a complete song.
Use plain language first, then name relevant theory as a label for what the player can hear.
You may reference only suggestion IDs included in ALLOWED SUGGESTIONS.
Never invent a chord action, suggestion ID, key, recording detail, or personal fact.
Keep the answer under 120 words. Do not use markdown, speech markup, or stage directions.`;

export function buildMentorInput(request: MentorRequest): string {
  const key = request.context.key
    ? `${formatChord({ root: request.context.key.tonic, quality: request.context.key.mode })} (${Math.round(request.context.key.confidence * 100)}% confidence)`
    : "not established";
  const progression =
    request.context.progression.length > 0
      ? request.context.progression.map(formatChord).join(" → ")
      : "none yet";
  const current = request.context.currentChord ? formatChord(request.context.currentChord) : "none";
  const suggestions = request.context.allowedSuggestions.map((suggestion) => ({
    id: suggestion.id,
    route: suggestion.route.map(formatChord),
    bearing: suggestion.bearing,
    function: suggestion.functionLabel,
    emotions: suggestion.emotionTags,
    explanation: suggestion.explanation,
  }));

  return JSON.stringify({
    task: "Answer the player's question using only this bounded symbolic context.",
    question: request.question,
    requestedIntent: request.intent,
    assistanceLevel: request.context.assistanceLevel,
    sectionType: request.context.sectionType ?? "unspecified",
    currentChord: current,
    likelyKey: key,
    progression,
    allowedSuggestions: suggestions,
  });
}
