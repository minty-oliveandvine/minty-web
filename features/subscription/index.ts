/**
 * THE public surface of the subscription feature. `app/subscription/**` re-exports from here
 * and nothing else may import anything deeper (eslint.config.mjs, boundaries/entry-point).
 *
 * Route components only, plus where the feature is mounted - and ONE self-contained widget,
 * `SubscriptionsOverviewCard`, which the shell composes into My Profile's slot
 * (`app/profile/page.tsx`): it reads its own data and draws itself, so the profile knows
 * nothing about subscriptions. No API clients, no hooks, no plain components leak out: the
 * shell renders what it is given and knows nothing about how it works, which is what makes the
 * folder liftable (README.md).
 */

export { AddCard, EditCard } from "@/features/subscription/routes/CardPages";
export { BillingDetails } from "@/features/subscription/routes/BillingDetailsPage";
export { BillingPage } from "@/features/subscription/routes/BillingPage";
export { ManageSubscriptions } from "@/features/subscription/routes/ManageSubscriptions";
export { LegacyModuleSettingsPage, ModuleSettingsPage } from "@/features/subscription/routes/ModuleSettingsPage";
export { SubscriptionOverview } from "@/features/subscription/routes/SubscriptionOverview";
export { SubscriptionRequests } from "@/features/subscription/routes/SubscriptionRequests";
export { TransferSubscription } from "@/features/subscription/routes/TransferSubscription";
export { SubscriptionLayout } from "@/features/subscription/routes/SubscriptionLayout";
export { SubscriptionsOverviewCard } from "@/features/subscription/routes/SubscriptionsOverviewCard";
export { SUBSCRIPTION_BASE_PATH } from "@/features/subscription/lib/paths";
