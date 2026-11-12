/**
 * The response headers set in next.config.ts. A header scanner (or `curl -I`) should find the
 * standard ones, and no other site may show this app inside a frame.
 */
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("security headers", () => {
  it("are sent with every response", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");

    const sent = Object.fromEntries(rules[0].headers.map((header) => [header.key, header.value]));
    expect(sent["X-Content-Type-Options"]).toBe("nosniff");
    expect(sent["Referrer-Policy"]).toBe("no-referrer");
    expect(sent["X-Frame-Options"]).toBe("DENY");
    expect(sent["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(sent["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
  });

  it("do not include a policy that could block the app's own scripts or styles", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const policy = rules[0].headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
    expect(policy).not.toMatch(/script-src|style-src|default-src|connect-src/);
  });

  it("do not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
