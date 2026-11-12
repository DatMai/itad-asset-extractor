import type { NextConfig } from "next";

/**
 * Headers sent with every response. None of them changes how the app runs; they only tell the
 * browser what this site never needs.
 *
 * There is on purpose no script-src / style-src / connect-src policy. Next.js puts inline
 * scripts in the page and needs 'unsafe-eval' in development, so a wrong policy shows a blank
 * page, and it has to be tried in a browser in both dev and production before it is added.
 * "frame-ancestors" restricts nothing the page loads, so it is safe on its own.
 */
const SECURITY_HEADERS = [
  // Do not guess a file's type from its content: a sample file is never run as a script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Do not tell other sites which page a visitor came from.
  { key: "Referrer-Policy", value: "no-referrer" },
  // No other site may show this app in a frame and trick a visitor into clicking "Ask AI".
  // X-Frame-Options is the older header, frame-ancestors the current one; both for old browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // The app never uses the camera, the microphone or the location.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Do not send "X-Powered-By: Next.js": it only helps someone looking for a known weakness.
  poweredByHeader: false,
  // "/:path*" matches "/" and every path below it, including /samples and /api.
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
