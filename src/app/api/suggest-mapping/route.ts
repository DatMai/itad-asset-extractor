/**
 * POST /api/suggest-mapping: the optional second opinion on columns the rules left unclear.
 *
 * This is the only code that runs on the server and the only place where data leaves the
 * browser. It receives column names and a few masked sample values (see buildSuggestRequest),
 * asks Claude which field each unclear column holds, and returns the answer. The API key stays here.
 * Whatever goes wrong, the browser keeps the mapping the rules produced.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { buildUserMessage, SYSTEM_PROMPT } from "@/lib/llm/prompt";
import { SuggestionsSchema, SuggestRequestSchema } from "@/lib/llm/schema";

/** Anthropic's current default model. Set ANTHROPIC_MODEL to use a cheaper one such as claude-haiku-5-5. */
const DEFAULT_MODEL = "claude-opus-5-5";

/**
 * The largest body we read. The biggest request the browser can build is 60 columns of a
 * 120-character name and five 80-character samples; in a script that needs three bytes per
 * character that is about 100 KB. Anything larger is not from our app.
 */
const MAX_BODY_BYTES = 128_000;

/**
 * Room for one short entry per column (60 at most, about 50 tokens each). It is also the cost
 * ceiling of one call, which matters because anyone who can reach this route can call it.
 * A cut-off answer is reported as "no usable answer" and the rules' mapping stands.
 */
const MAX_ANSWER_TOKENS = 3000;

/** One sentence fits easily; the browser shows the reason beside the column. */
const MAX_REASON_LENGTH = 200;

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail(503, "The AI suggestion is not configured on this server.");

  // Size first, so a huge body is never held in memory; then the schema caps the number of
  // columns and samples and their lengths. Nothing is spent on a request that fails either.
  const text = await readBody(request, MAX_BODY_BYTES);
  if (text === "too-large") return fail(413, "The request is too large.");
  const body = SuggestRequestSchema.safeParse(parseJson(text));
  if (!body.success) return fail(400, "The request was not in the expected format.");

  try {
    // 30 s and one retry: a suggestion that takes longer is not worth waiting for.
    const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
    const response = await client.messages.parse({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
      max_tokens: MAX_ANSWER_TOKENS,
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
    return Response.json(trimAnswer(response.parsed_output, body.data.columns.length));
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

/**
 * Read the request body as text, giving up as soon as it is larger than `limit` bytes.
 * Content-Length is checked first because it costs nothing, but it can be missing or wrong,
 * so the bytes are also counted while they arrive.
 */
async function readBody(request: Request, limit: number): Promise<string | "too-large"> {
  if (Number(request.headers.get("content-length") ?? 0) > limit) return "too-large";
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel(); // tell the sender to stop; the rest is never read
      return "too-large";
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** JSON.parse that answers null instead of throwing; the schema then rejects null. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Bound what goes back to the browser. Done here, in code, because the model's structured
 * output does not enforce length limits: at most one suggestion per column, and short reasons.
 */
function trimAnswer(answer: z.infer<typeof SuggestionsSchema>, columnCount: number) {
  return {
    suggestions: answer.suggestions
      .slice(0, columnCount)
      .map((suggestion) => ({ ...suggestion, reason: suggestion.reason.slice(0, MAX_REASON_LENGTH) })),
  };
}
