/**
 * The two cards side by side. Where each card's CTA goes is the page's look
 * (`pageLook`): inside the card on frame 03-A, which is the tall 504px card; below it on the
 * other frames, whose cards end under the status line - or, when both cards share the same
 * "Manage Subscription" (frames 03-B, 03-C), one CTA centred under the pair. No CTAs at all
 * for a viewer who may not manage the subscription.
 */

import type { ModuleCode } from "@/features/subscription/api/moduleSettings";
import {
  pageLook,
  type ModuleCta as ModuleCtaModel,
  type ModuleView,
} from "@/features/subscription/lib/moduleState";

import { ModuleCard } from "@/features/subscription/components/ModuleCard";
import { ModuleCta } from "@/features/subscription/components/ModuleCta";

export type ModuleCtaHandlers = {
  startTrial: (code: ModuleCode) => void;
  manage: () => void;
  activate: (code: ModuleCode) => void;
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
  const look = pageLook(views);
  const inline = look === "inline";
  const own = (view: ModuleView) =>
    canManage && !shared ? (
      <ModuleCta
        cta={view.cta}
        busy={busyCode === view.code}
        onClick={press(view.cta, view.code, on)}
      />
    ) : null;
  return (
    <div className="flex flex-col items-center gap-7">
      <ul className="flex flex-wrap justify-center gap-11">
        {views.map((view) => (
          <li key={view.code} className="flex flex-col items-center gap-7">
            <ModuleCard view={view} look={look}>
              {inline ? own(view) : null}
            </ModuleCard>
            {inline ? null : own(view)}
          </li>
        ))}
      </ul>
      {canManage && shared && <ModuleCta cta={shared} onClick={on.manage} />}
    </div>
  );
}
