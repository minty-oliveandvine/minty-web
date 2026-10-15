/**
 * Frame 03-F: a renewal failed and the modules are suspended. "here" opens the billing page on
 * the account the failing company is on (`BILLING.account`) - the card that needs fixing.
 */

import { Icon } from "@/components/ui/Icon";

export function PaymentFailedBanner({
  onUpdatePaymentMethod,
}: {
  onUpdatePaymentMethod: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex w-full items-center gap-3 rounded-lg border border-transparent bg-danger-bg px-4 py-3 text-body-m text-danger"
    >
      <Icon name="warning" size={24} className="shrink-0 text-danger" />
      <p className="flex-1">
        Payment failed. Update your payment method{" "}
        <button
          type="button"
          onClick={onUpdatePaymentMethod}
          className="-mx-1 inline-flex min-h-11 items-center rounded-lg px-1 font-semibold text-link underline underline-offset-2 hover:bg-hover"
        >
          here
        </button>
        .
      </p>
    </div>
  );
}
