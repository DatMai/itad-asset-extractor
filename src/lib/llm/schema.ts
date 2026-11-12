/**
 * The shapes that cross the network for the optional AI suggestion. The same schemas are used
 * by the browser (to build the request), the route (to validate it) and the Claude call (to
 * constrain the answer), so the three cannot drift apart.
 */
import { z } from "zod";
import { FIELD_KEYS } from "@/lib/extraction/types";

/** What the model may answer for a column. "unmapped" lets it say "I cannot tell". */
const AI_TARGETS = [...FIELD_KEYS, "combined", "unmapped"] as const;

/** Browser -> route. The limits keep one request small and cheap, whoever sends it. */
export const SuggestRequestSchema = z.object({
  columns: z
    .array(
      z.object({
        index: z.number().int().min(0).max(1000),
        header: z.string().max(120),
        /**
         * What our rules decided for this column; null for the columns we are asking about.
         * A fixed list, not free text: the route is open, and free text here would let a caller
         * pass the model anything.
         */
        mappedTo: z.enum([...FIELD_KEYS, "combined", "ignore"]).nullable(),
        /** Up to five values, only for the columns we are asking about. */
        samples: z.array(z.string().max(80)).max(5),
      }),
    )
    .min(1)
    .max(60),
});
export type SuggestRequest = z.infer<typeof SuggestRequestSchema>;

/**
 * Claude -> route -> browser. No length limits here on purpose: the model's structured output
 * does not enforce them, so a long reason would turn a good answer into an error. The route
 * trims the answer after parsing instead (see trimAnswer in route.ts).
 */
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
