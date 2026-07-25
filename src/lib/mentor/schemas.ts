import { z } from "zod";

import { mentorResponseSchema } from "@/types/music";

export const mentorAiPayloadSchema = mentorResponseSchema.omit({ mode: true }).extend({
  actions: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        type: z.enum(["preview", "focus-suggestion", "open-diagram", "start-challenge"]),
        suggestionId: z.string().max(120).optional(),
      }),
    )
    .max(3),
});

export type MentorAiPayload = z.infer<typeof mentorAiPayloadSchema>;
