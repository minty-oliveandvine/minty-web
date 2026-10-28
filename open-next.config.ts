// OpenNext's Cloudflare adapter: `npm run cf:build` turns the Next.js build into a Worker
// (.open-next/). The prerendered pages (the Terms and Privacy versions and their /api/legal
// JSON) are served from the static-assets incremental cache: rendering them live would run
// lib/legal/registry.server.ts's node:fs reads, which find nothing in a Worker (404). Read-only
// is enough - nothing here uses ISR or revalidation.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({ incrementalCache: staticAssetsIncrementalCache });
