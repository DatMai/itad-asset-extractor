/**
 * The shapes that cross the network for the optional AI suggestion. The same schemas are used
 * by the browser (to build the request), the route (to validate it) and the Claude call (to
 * constrain the answer), so the three cannot drift apart.
 */
import { z } from "zod";
import { FIELD_KEYS } from "@/lib/extraction/types";

/** What the model may answer for a column. "unmapped" lets it say "I cannot tell". */
export const AI_TARGETS = [...FIELD_KEYS, "combined", "unmapped"] as const;

/** Browser -> route. The limits keep one request small and cheap, whoever sends it. */
export const SuggestRequestSchema = z.object({
  columns: z
    .array(
      z.object({
        index: z.number().int().min(0).max(1000),
        header: z.string().max(120),
        /** What our rules decided for this column; null for the columns we are asking about. */
        mappedTo: z.string().max(40).nullable(),
        /** Up to five values, only for the columns we are asking about. */
        samples: z.array(z.string().max(80)).max(5),
      }),
    )
    .min(1)
    .max(60),
});
export type SuggestRequest = z.infer<typeof SuggestRequestSchema>;

/** Claude -> route -> browser. */
export const SuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      index: z.number().int(),
      target: z.enum(AI_TARGETS),
      confidence: z.number(),
      reason: z.string(),
    }),
  ),
});
export type Suggestions = z.infer<typeof SuggestionsSchema>;
