import { mentorResponseSchema, type MentorRequest, type MentorResponse } from "@/types/music";

import { mentorAiPayloadSchema, type MentorAiPayload } from "./schemas";

export function validateAiMentorResponse(
  value: unknown,
  request: MentorRequest,
): MentorResponse | undefined {
  const parsed = mentorAiPayloadSchema.safeParse(value);
  if (!parsed.success) return undefined;

  const allowedIds = new Set(request.context.allowedSuggestions.map((suggestion) => suggestion.id));
  for (const action of parsed.data.actions) {
    if (
      (action.type === "preview" || action.type === "focus-suggestion") &&
      (!action.suggestionId || !allowedIds.has(action.suggestionId))
    ) {
      return undefined;
    }
    if (action.suggestionId && !allowedIds.has(action.suggestionId)) {
      return undefined;
    }
  }

  return mentorResponseSchema.parse({ ...parsed.data, mode: "ai" });
}

export function mentorJsonSchema(): Record<string, unknown> {
  const action = {
    type: "object",
    additionalProperties: false,
    properties: {
      label: { type: "string", maxLength: 80 },
      type: {
        type: "string",
        enum: ["preview", "focus-suggestion", "open-diagram", "start-challenge"],
      },
      suggestionId: { type: ["string", "null"], maxLength: 120 },
    },
    required: ["label", "type", "suggestionId"],
  };

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string", maxLength: 1000 },
      insight: { type: ["string", "null"], maxLength: 400 },
      actions: { type: "array", maxItems: 3, items: action },
      theoryTerms: {
        type: "array",
        maxItems: 6,
        items: { type: "string", maxLength: 80 },
      },
    },
    required: ["answer", "insight", "actions", "theoryTerms"],
  };
}

export function normalizeStructuredPayload(value: unknown): MentorAiPayload | unknown {
  if (!value || typeof value !== "object") return value;
  const payload = value as Record<string, unknown>;
  return {
    ...payload,
    insight: payload.insight === null ? undefined : payload.insight,
    actions: Array.isArray(payload.actions)
      ? payload.actions.map((action) => {
          if (!action || typeof action !== "object") return action;
          const record = action as Record<string, unknown>;
          return {
            ...record,
            suggestionId: record.suggestionId === null ? undefined : record.suggestionId,
          };
        })
      : payload.actions,
  };
}
