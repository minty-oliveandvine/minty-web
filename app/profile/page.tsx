// My Profile, with the subscription feature's overview card in its slot - the one place the
// two features meet (eslint.config.mjs: app/profile may import both indexes, and nothing else).
import { ProfilePage } from "@/features/profile";
import { SubscriptionsOverviewCard } from "@/features/subscription";

export default function Page() {
  return <ProfilePage subscriptions={<SubscriptionsOverviewCard />} />;
}
