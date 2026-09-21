import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Slightly smaller responses; security-through-obscurity only. */
  poweredByHeader: false,
  /**
   * Next 16 refuses dev-only requests (HMR, the hydration payload) from an origin other than the
   * one the dev server was started as; without this, opening http://127.0.0.1:3002 renders the
   * HTML and never hydrates - the landing shows "Loading…" forever. 127.0.0.1 is what a
   * Windows-hosted test runner reaches for, because Node resolves `localhost` to ::1 first and
   * stalls ~2 s per request. Production is unaffected.
   */
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
