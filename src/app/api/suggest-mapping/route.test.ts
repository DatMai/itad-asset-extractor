/**
 * The route is tested with the Anthropic client replaced by a fake, so no key and no network are
 * needed. What is checked: what we send to the model, and what the browser gets back in every
 * case, including each kind of failure.
 */
import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_PROMPT } from "@/lib/llm/prompt";
import { POST } from "./route";

const parse = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", async () => {
  const actual = await vi.importActual<typeof import("@anthropic-ai/sdk")>("@anthropic-ai/sdk");
  // The real class, with the one method that would call the network replaced.
  class FakeAnthropic extends actual.default {
    constructor(options: ConstructorParameters<typeof actual.default>[0]) {
      super(options);
      this.messages.parse = parse;
    }
  }
  return { default: FakeAnthropic };
});

const validBody = {
  columns: [
    { index: 0, header: "Brand", mappedTo: "manufacturer", samples: [] },
    { index: 1, header: "Keeper", mappedTo: null, samples: ["Sarah Lee", "Tom Nguyen"] },
  ],
};
const answer = { suggestions: [{ index: 1, target: "assignedTo", confidence: 0.9, reason: "Names of people" }] };

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/suggest-mapping", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.ANTHROPIC_MODEL;
  parse.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {}); // failures are logged; keep test output clean
});
afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  vi.restoreAllMocks();
});

describe("POST /api/suggest-mapping", () => {
  it("returns the model's suggestions", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: answer });
    const response = await post(validBody);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(answer);
  });

  it("sends the instructions as the system prompt and only the columns as the user turn", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: answer });
    await post(validBody);

    const [request] = parse.mock.calls[0];
    expect(request.model).toBe("claude-opus-5-5");
    expect(request.system).toBe(SYSTEM_PROMPT);
    expect(request.messages).toEqual([{ role: "user", content: JSON.stringify(validBody.columns, null, 2) }]);
    expect(request.output_config.effort).toBe("low");
    expect(request.output_config.format.type).toBe("json_schema");
  });

  it("uses the model named in ANTHROPIC_MODEL when set", async () => {
    process.env.ANTHROPIC_MODEL = "claude-haiku-5-5";
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: answer });
    await post(validBody);
    expect(parse.mock.calls[0][0].model).toBe("claude-haiku-5-5");
  });

  it("says so when no API key is configured, without calling the model", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const response = await post(validBody);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/not configured/);
    expect(parse).not.toHaveBeenCalled();
  });

  it.each([
    ["not JSON", "{oops"],
    ["no columns", { columns: [] }],
    ["too many columns", { columns: Array.from({ length: 61 }, (_, index) => ({ index, header: "x", mappedTo: null, samples: [] })) }],
    ["too many samples", { columns: [{ index: 0, header: "x", mappedTo: null, samples: ["1", "2", "3", "4", "5", "6"] }] }],
    ["an oversized sample", { columns: [{ index: 0, header: "x", mappedTo: null, samples: ["y".repeat(81)] }] }],
  ])("rejects a request with %s, without calling the model", async (_label, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(parse).not.toHaveBeenCalled();
  });

  it.each([
    ["declines", { stop_reason: "refusal", parsed_output: null }],
    ["runs out of tokens", { stop_reason: "max_tokens", parsed_output: null }],
    ["answers outside the schema", { stop_reason: "end_turn", parsed_output: null }],
  ])("reports no usable answer when the model %s", async (_label, result) => {
    parse.mockResolvedValue(result);
    const response = await post(validBody);
    expect(response.status).toBe(502);
    expect((await response.json()).error).toMatch(/no usable answer/);
  });

  it("maps each kind of API failure to its own message, and leaks no detail", async () => {
    const headers = new Headers();
    const failures: [Error, number, RegExp][] = [
      [new Anthropic.AuthenticationError(401, { type: "error" }, "invalid x-api-key sk-secret", headers), 502, /API key/],
      [new Anthropic.RateLimitError(429, { type: "error" }, "slow down", headers), 429, /busy/],
      [new Anthropic.APIConnectionError({ message: "ECONNRESET" }), 504, /could not be reached/],
      [new Anthropic.InternalServerError(500, { type: "error" }, "boom", headers), 502, /returned an error \(500\)/],
      [new Error("something else"), 500, /unexpectedly/],
    ];
    for (const [failure, status, message] of failures) {
      parse.mockRejectedValueOnce(failure);
      const response = await post(validBody);
      const body = await response.json();
      expect(response.status, failure.constructor.name).toBe(status);
      expect(body.error).toMatch(message);
      expect(JSON.stringify(body)).not.toContain("sk-secret");
    }
  });
});
