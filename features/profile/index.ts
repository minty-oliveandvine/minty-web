/**
 * THE public surface of the My Profile feature. Only `app/layout.tsx` imports from here and
 * nothing else may import anything deeper (eslint.config.mjs, boundaries/entry-point).
 *
 * Route components only, plus where the feature is mounted - the same rule as
 * `features/subscription` (README.md). My Profile opens only as the sidebar's sheet
 * (`ProfilePanel`, composed into the sidebar's slot by `app/layout.tsx`); there is no `/profile`
 * page since 2026-11-03 (owner). It takes one slot, `subscriptions`, which the shell fills with
 * the subscription feature's overview card: features meet only in `app/`.
 */

export { ProfilePanel } from "@/features/profile/routes/ProfilePanel";
