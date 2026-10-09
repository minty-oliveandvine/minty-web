/**
 * Where the feature is mounted: TWO constants (app/login/**, app/signup) - as every feature here
 * does, the shell's `lib/hubPaths.ts` spells them too (`OPEN_PATHS`), and the paths test pins
 * them equal. Sign-up has its own route, like log in: `/login?mode=signup` only survives as
 * proxy.ts's redirect to it.
 */

export const AUTH_BASE_PATH = "/login";
export const AUTH_SIGNUP_PATH = "/signup";

export const AUTH_PATHS = {
  login: AUTH_BASE_PATH,
  confirm: `${AUTH_BASE_PATH}/confirm`,
  signup: AUTH_SIGNUP_PATH,
} as const;
