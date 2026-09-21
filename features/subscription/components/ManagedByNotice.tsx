/**
 * Shown instead of the buttons when the viewer may not change the subscription: Flask's copy
 * (`module_subscription_section.html`) - the payer is named when there is one, else only
 * admins can act.
 */

export function ManagedByNotice({ payer }: { payer: { name: string; email: string } | null }) {
  return (
    <p className="text-sm text-[var(--ink-soft)]">
      {payer ? (
        <>
          Billing for this company is managed by {payer.name}{" "}
          <a className="underline" href={`mailto:${payer.email}`}>
            {payer.email}
          </a>{" "}
          — only they can change its subscription.
        </>
      ) : (
        "Only admins can change modules."
      )}
    </p>
  );
}
