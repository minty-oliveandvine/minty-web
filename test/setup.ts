// Runs before every test file.
//
// jest-dom's matchers are imported from the '/vitest' entry point, not the bare package: the
// bare one registers against Jest's expect and silently adds nothing here.

import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// The header's badge and the side menu read the viewer from Flask on mount (@minty/shared/viewer,
// through lib/viewer.ts). A screen test queues its fetch answers in order and counts the calls -
// a read it never asked for would take one of them. So nobody is looking unless a test says who.
//
// Imported INSIDE the hook, never at the top of this file, and that is load-bearing: since
// 2026-10-12 `@/lib/viewer` pulls in components/ui/sidebarHost (it registers the host), and with
// it lib/auth, lib/env, lib/hubPaths, lib/mintyEntry, lib/moduleClaims, lib/apiClient and
// next/navigation - all of them evaluated before any test file's `vi.mock` is registered, which
// binds their imports to the real modules for good. A test would then mock next/navigation and
// watch the sidebar ignore it (it did: the menu stopped closing on a move between pages).
// minty-payment-request-web's test/setup.dom.ts does the same, for the same reason.
beforeEach(async () => {
  const { _setViewerLoaderForTests } = await import("@/lib/viewer");
  _setViewerLoaderForTests(() => Promise.resolve(null));
});

// findBy*/waitFor wait 2.5s, not the default 1s. The screens here render a list of twenty-odd
// companies, read two endpoints for the row that opens and hold a 1.2s "Calculating…" beat -
// under a full-suite run that is regularly more than a second, and the flake it produced was
// always "the element isn't there yet", never a real absence.
configure({ asyncUtilTimeout: 2500 });

// RTL only auto-cleans when a global `afterEach` exists, and this project runs with globals
// disabled -- so without this, every render stacks up in the same document.
afterEach(() => {
  cleanup();
  // Every test starts with an empty cookie jar; lib/auth.ts is cookie-backed.
  for (const c of document.cookie.split("; ").filter(Boolean)) {
    document.cookie = `${c.split("=")[0]}=;path=/;max-age=0`;
  }
});
