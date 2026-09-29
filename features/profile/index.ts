/**
 * THE public surface of the My Profile feature. `app/profile/**` and `app/layout.tsx` import from
 * here and nothing else may import anything deeper (eslint.config.mjs, boundaries/entry-point).
 *
 * Route components only, plus where the feature is mounted - the same rule as
 * `features/subscription` (README.md). Two ways to show it: `ProfilePage` (the `/profile` page)
 * and `ProfilePanel` (My Profile in the sidebar, composed into the sidebar's slot by
 * `app/layout.tsx`). Each takes one slot, `subscriptions`, which the shell fills with the
 * subscription feature's overview card: features meet only in `app/`.
 */

export { ProfilePage } from "@/features/profile/routes/ProfilePage";
export { ProfilePanel } from "@/features/profile/routes/ProfilePanel";
export { PROFILE_BASE_PATH } from "@/features/profile/lib/paths";
