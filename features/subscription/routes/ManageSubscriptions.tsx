"use client";

/**
 * `/subscription` and `/subscription/subscriptions` - the payer portal's Manage Subscriptions
 * list (billing-frontend's /profile/subscriptions, re-homed and redrawn to Figma section 04).
 * The query string carries `entity` (the company to bring into view, opened in place - the
 * module page's *Manage Subscription* lands here), and three dev-only switches (see the hooks):
 * `fixture` (the list's frame, A/B/F), `summary` (the open row's 05·A frame, M11 … N21a) and
 * `result` (the 05·C frame the open row lands on, RU22 … RNX21a). `transferred=1` beside
 * `entity` is how accepting a handover lands here (07-M), and `started=<code>` beside it is how
 * a trial started on the module settings page lands here (RV11).
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ManageSubscriptionsScreen } from "@/features/subscription/routes/ManageSubscriptionsScreen";

function Content() {
  const q = useSearchParams();
  return (
    <ManageSubscriptionsScreen
      focusEntityId={q.get("entity")}
      fixture={q.get("fixture")}
      summaryFixture={q.get("summary")}
      resultFixture={q.get("result")}
      transferred={q.get("transferred") === "1"}
      startedCode={q.get("started")}
      tickCode={q.get("tick")}
    />
  );
}

export function ManageSubscriptions() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
