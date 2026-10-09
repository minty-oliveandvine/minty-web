/**
 * THE public surface of the sign-in feature (phase 2, 2026-10-05). `app/login/**` and
 * `app/signup` re-export from here and nothing else may import anything deeper
 * (eslint.config.mjs, boundaries/entry-point).
 */

export { LoginConfirmPage, LoginPage, SignUpPage } from "@/features/auth/routes/LoginPages";
export { AUTH_BASE_PATH, AUTH_SIGNUP_PATH } from "@/features/auth/lib/paths";
