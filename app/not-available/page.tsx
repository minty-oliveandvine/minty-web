import Link from "next/link";

import { env } from "@/lib/env";

/**
 * Where /subscription/* lands while the feature is dark (NEXT_PUBLIC_SUBSCRIPTION_ENABLED=0 -
 * proxy.ts). The backends answer 404 in that state whatever this app believes; this page
 * exists so nobody is shown a door that opens onto "not found".
 */
export default function NotAvailable() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold">Subscriptions aren&apos;t available yet</h1>
      <p className="mt-2 text-muted">This part of Minty isn&apos;t switched on for your account.</p>
      <p className="mt-6">
        <Link className="underline" href={env.MINTY_URL}>
          Back to Minty
        </Link>
      </p>
    </main>
  );
}
