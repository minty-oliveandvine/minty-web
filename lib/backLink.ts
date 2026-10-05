/**
 * "Back" on the settings-type pages: to the page the person came from (2026-10-05).
 *
 * It replaced the `?from=bills` flag, which told only two places apart and was dropped by most
 * links on the way. "Came from" = the last page in this tab's history OUTSIDE this app's settings
 * area (the module page and My Profile): reloads and in-page moves add entries inside the area,
 * and Back skips them.
 *
 * - Navigation API: walk back over this origin's entries. The first one outside the area is the
 *   target. If they run out, the person came from another app (Flask, Payments) and the entry
 *   before them is that app's page; if there is none (a new tab), follow the fallback.
 * - Without it: `history.back()` when there is anything to go back to, else the fallback.
 *
 * Flask's static/js/back_link.js is the same rule for its settings pages.
 */

const SETTINGS_AREA = [/^\/subscription\/entities\/[^/]+\/modules\/?$/, /^\/profile\/?$/];

type NavEntry = { index: number; url: string | null };
type NavigationLike = { currentEntry: NavEntry | null; entries(): NavEntry[] };

export function inSettingsArea(href: string | null, origin: string): boolean {
  if (!href) return false;
  try {
    const url = new URL(href, origin);
    return url.origin === origin && SETTINGS_AREA.some((rule) => rule.test(url.pathname));
  } catch {
    return false;
  }
}

/**
 * How many entries to go back (0 = nothing to go back to), or null when the browser cannot say
 * (no Navigation API).
 *
 * `navigation.entries()` lists only THIS origin's run of entries, and an entry's `index` is its
 * place in that list - not in the tab's whole history. So when every entry before this one is in
 * the settings area, `historyLength` tells whether another app's page came before the run: the
 * tab holds more entries than the run (a new navigation clears the forward ones).
 */
export function stepsBack(
  nav: NavigationLike | undefined,
  origin: string,
  historyLength: number,
): number | null {
  if (!nav?.currentEntry || typeof nav.entries !== "function") return null;
  const entries = nav.entries();
  const at = nav.currentEntry.index;
  if (at < 0 || at >= entries.length) return null;
  for (let p = at - 1; p >= 0; p -= 1) {
    if (!inSettingsArea(entries[p].url, origin)) return at - p;
  }
  return historyLength > entries.length ? at + 1 : 0;
}

/** Go back as above, or to `fallback` when there is nothing to go back to. */
export function goBack(fallback: string): void {
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  const steps = stepsBack(nav, window.location.origin, window.history.length);
  if (steps === null) {
    if (window.history.length > 1) window.history.back();
    else window.location.assign(fallback);
    return;
  }
  if (steps > 0) window.history.go(-steps);
  else window.location.assign(fallback);
}
