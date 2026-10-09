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
      className="mx-auto flex w-full max-w-[718px] items-center gap-4 rounded-xl border border-danger bg-danger-bg px-4 py-3 sm:gap-6 sm:px-8 text-base text-ink"
    >
      <Icon name="warning" size={40} className="shrink-0 text-danger" />
      <p className="flex-1 text-center">
        Payment failed. Update your payment method{" "}
        <button
          type="button"
          onClick={onUpdatePaymentMethod}
          className="font-medium text-link underline-offset-2 hover:underline"
        >
          here
        </button>
        .
      </p>
    </div>
  );
}
