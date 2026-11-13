/**
 * Shown instead of the buttons when the viewer may not change the subscription. Only the
 * company's subscriber may (owner, 2026-11-13: its creator, or whoever it was handed to):
 * - someone else holds it - named, with their email (Flask's `module_subscription_section.html`);
 * - nobody is assigned yet - nobody may change it until someone is (`subscriberSet` false);
 * - the viewer holds it but is not an admin of the company - only admins can change modules.
 */

export const UNASSIGNED =
  "This company's subscriber hasn't been set yet, so its subscription can't be changed for now.";

export function ManagedByNotice({
  payer,
  subscriberSet = true,
}: {
  payer: { name: string; email: string } | null;
  /** False when nobody holds the subscription. Omitted (an older answer), it is set. */
  subscriberSet?: boolean;
}) {
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
      ) : !subscriberSet ? (
        UNASSIGNED
      ) : (
        "Only admins can change modules."
      )}
    </p>
  );
}
