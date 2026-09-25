/**
 * THE public surface of the subscription feature. `app/subscription/**` re-exports from here
 * and nothing else may import anything deeper (eslint.config.mjs, boundaries/entry-point).
 *
 * Route components only, plus where the feature is mounted. No API clients, no hooks, no
 * components leak out: the shell renders the feature's pages and knows nothing about how they
 * work, which is what makes the folder liftable (README.md).
 */

export { AddCard, EditCard } from "@/features/subscription/routes/CardPages";
export { BillingDetails } from "@/features/subscription/routes/BillingDetailsPage";
export { BillingPage } from "@/features/subscription/routes/BillingPage";
export { ManageSubscriptions } from "@/features/subscription/routes/ManageSubscriptions";
export { ModuleSettingsPage } from "@/features/subscription/routes/ModuleSettingsPage";
export { NotBuiltYet } from "@/features/subscription/routes/NotBuiltYet";
export { SubscriptionOverview } from "@/features/subscription/routes/SubscriptionOverview";
export { SubscriptionRequests } from "@/features/subscription/routes/SubscriptionRequests";
export { TransferSubscription } from "@/features/subscription/routes/TransferSubscription";
export { SubscriptionLayout } from "@/features/subscription/routes/SubscriptionLayout";
export { SUBSCRIPTION_BASE_PATH } from "@/features/subscription/lib/paths";
