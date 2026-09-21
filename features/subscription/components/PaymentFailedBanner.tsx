/**
 * Frame 03-F: a renewal failed and the modules are suspended. "here" opens the payment-method
 * screen (a seam - `moduleRoutes(id).paymentMethod`).
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
      className="mx-auto flex w-full max-w-[718px] items-center gap-6 rounded-xl border border-[var(--alert-border)] bg-[var(--alert-bg)] px-8 py-3 text-base text-black"
    >
      <Icon name="warning" size={40} className="shrink-0 text-[var(--alert-icon)]" />
      <p className="flex-1 text-center">
        Payment failed. Update your payment method{" "}
        <button
          type="button"
          onClick={onUpdatePaymentMethod}
          className="font-medium text-secondary underline-offset-2 hover:underline"
        >
          here
        </button>
        .
      </p>
    </div>
  );
}
