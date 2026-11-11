/**
 * POST /api/suggest-mapping: the optional second opinion on columns the rules left unclear.
 *
 * This is the only code that runs on the server and the only place where data leaves the
 * browser. It receives column names and a few sample values (see buildSuggestRequest), asks
 * Claude which field each unclear column holds, and returns the answer. The API key stays here.
 * Whatever goes wrong, the browser keeps the mapping the rules produced.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { buildUserMessage, SYSTEM_PROMPT } from "@/lib/llm/prompt";
import { SuggestionsSchema, SuggestRequestSchema } from "@/lib/llm/schema";

/** Anthropic's current default model. Set ANTHROPIC_MODEL to use a cheaper one such as claude-haiku-5-5. */
const DEFAULT_MODEL = "claude-opus-5-5";

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail(503, "The AI suggestion is not configured on this server.");

  // Validate before spending anything: the schema caps columns, samples and their lengths.
  const body = SuggestRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "The request was not in the expected format.");

  try {
    // 30 s and one retry: a suggestion that takes longer is not worth waiting for.
    const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
    const response = await client.messages.parse({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
      max_tokens: 8000, // room for 60 columns plus the model's thinking; also a cost ceiling
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(body.data) }],
      output_config: {
        effort: "low", // a short classification; deeper reasoning adds time, not accuracy
        format: zodOutputFormat(SuggestionsSchema), // the answer must match our schema
      },
    });

    // A refusal or a cut-off answer has no valid JSON; parsed_output is null in those cases.
    if (response.stop_reason !== "end_turn" || !response.parsed_output) {
      return fail(502, "The AI gave no usable answer. The mapping was left as it is.");
    }
    return Response.json(response.parsed_output);
  } catch (error) {
    console.error("suggest-mapping failed:", error);
    // Most specific first. The messages are ours: API error text can contain details we should not echo.
    if (error instanceof Anthropic.AuthenticationError) return fail(502, "The AI service rejected the server's API key.");
    if (error instanceof Anthropic.RateLimitError) return fail(429, "The AI service is busy. Try again in a minute.");
    if (error instanceof Anthropic.APIConnectionError) return fail(504, "The AI service could not be reached.");
    if (error instanceof Anthropic.APIError) return fail(502, `The AI service returned an error (${error.status}).`);
    return fail(500, "The AI suggestion failed unexpectedly.");
  }
}
