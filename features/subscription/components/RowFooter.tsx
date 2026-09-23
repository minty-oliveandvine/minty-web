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
 */

export const AUTO_RENEW =
  "Minty subscriptions auto-renew monthly until cancellation is initiated. There is a 1 month notice period required for your cancellation.";

export function RowFooter({
  entityName,
  createdOn,
  renewalOn,
}: {
  entityName: string;
  createdOn: string | null;
  renewalOn: string | null;
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
        {AUTO_RENEW}
      </p>
    </div>
  );
}
