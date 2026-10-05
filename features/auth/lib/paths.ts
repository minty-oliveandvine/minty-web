/**
 * Where the feature is mounted: ONE constant (app/login/**), as every feature here does - the
 * shell's `lib/hubPaths.ts` spells it too (`OPEN_PATHS`), and the paths test pins the two equal.
 */

export const AUTH_BASE_PATH = "/login";

export const AUTH_PATHS = {
  login: AUTH_BASE_PATH,
  confirm: `${AUTH_BASE_PATH}/confirm`,
  signup: `${AUTH_BASE_PATH}?mode=signup`,
} as const;
