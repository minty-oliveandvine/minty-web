/**
 * The paragraph under an open row - the same one on the summary row (Figma 05·A) and on a
 * result row (05·C, e.g. RV11): when the company was created, when it renews, and the standing
 * terms. The design draws it as ONE text node, identical in all 99 frames that carry it but for
 * the company's name.
 *
 * Its three parts are guarded SEPARATELY, and that is the point: the last two sentences are
 * terms, not status - they carry no date and belong under every company, whether anything bills
 * or not. Hanging them off the renewal date (as they were until 2026-09-23) made them vanish
 * for any company whose only module is a free trial, which is exactly RV11's company.
 *
 * A company on free trials only (`trial`) reads the trial's terms instead (owner, 2026-11-10):
 * nothing is paid for, so there is nothing to cancel, and a trial's tick only says whether it
 * continues on a paid plan. The standing terms come back once a module is paid for.
 */

export const AUTO_RENEW =
  "Minty subscriptions auto-renew monthly until cancellation is initiated. There is a 1 month notice period required for your cancellation.";

export const TRIAL_TERMS =
  "Free trials cost nothing. When a trial ends, only the modules you've confirmed continue on a monthly plan, and renew each month after that.";

export function RowFooter({
  entityName,
  createdOn,
  renewalOn,
  trial,
}: {
  entityName: string;
  createdOn: string | null;
  renewalOn: string | null;
  trial: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 text-[15px] text-quiet">
      {createdOn && (
        <p>
          Minty for <span className="text-[#219994]">{entityName}</span> was originally created{" "}
          {createdOn}.
        </p>
      )}
      <p>
        {renewalOn && `Your next subscription renewal date is ${renewalOn} and each month after. `}
        {trial ? TRIAL_TERMS : AUTO_RENEW}
      </p>
    </div>
  );
}
