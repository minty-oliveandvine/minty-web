/**
 * The two cards side by side in an equal grid (one column on a phone, two from `sm`), what goes
 * under a card 16px below it. Each card's CTA sits under it - or,
 * when both cards share the same "Manage Subscription" (frames 03-B, 03-C), one CTA centred
 * under the pair. No CTAs at all for a viewer who may not manage the subscription.
 */

import type { ModuleCode } from "@/features/subscription/api/moduleSettings";
import type {
  ModuleCta as ModuleCtaModel,
  ModuleView,
} from "@/features/subscription/lib/moduleState";

import { ModuleCard } from "@/features/subscription/components/ModuleCard";
import { ModuleCta } from "@/features/subscription/components/ModuleCta";

export type ModuleCtaHandlers = {
  startTrial: (code: ModuleCode) => void;
  manage: () => void;
  activate: (code: ModuleCode) => void;
  /**
   * Confirming a started trial: the Billing Accounts picker, here on the page. Per COMPANY,
   * so it takes no code - confirming billing stamps every module row of the entity.
   */
  activateTrial: () => void;
  resume: (code: ModuleCode) => void;
  reactivate: (code: ModuleCode) => void;
};

function press(cta: ModuleCtaModel, code: ModuleCode, on: ModuleCtaHandlers): () => void {
  switch (cta.kind) {
    case "start_trial":
      return () => on.startTrial(code);
    case "manage":
      return on.manage;
    case "activate":
      return () => on.activate(code);
    case "activate_trial":
      return on.activateTrial;
    case "resume":
      return () => on.resume(code);
    case "reactivate":
      return () => on.reactivate(code);
  }
}

export function ModuleCardGrid({
  views,
  shared,
  canManage,
  busyCode,
  on,
}: {
  views: ModuleView[];
  shared: ModuleCtaModel | null;
  canManage: boolean;
  busyCode: ModuleCode | null;
  on: ModuleCtaHandlers;
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      <ul className="grid w-full gap-4 sm:grid-cols-2">
        {views.map((view) => (
          <li key={view.code} className="flex min-w-0 flex-col gap-4">
            <ModuleCard view={view} />
            {canManage && !shared && (
              <ModuleCta
                cta={view.cta}
                busy={busyCode === view.code}
                onClick={press(view.cta, view.code, on)}
              />
            )}
          </li>
        ))}
      </ul>
      {/* Dispatched through `press` like any other CTA, not hard-wired to `on.manage`: the
          shared slot carries `activate_trial` too since both cards awaiting activation are one
          company-wide act. The code is irrelevant for either kind - that is what COMPANY_WIDE
          means - but it is `press` that knows which handler to call. */}
      {canManage && shared && views.length > 0 && (
        <div className="mx-auto flex w-full justify-center sm:w-[calc(50%-0.5rem)]">
          <ModuleCta cta={shared} onClick={press(shared, views[0].code, on)} />
        </div>
      )}
    </div>
  );
}
