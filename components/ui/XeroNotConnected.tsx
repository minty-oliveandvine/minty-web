/**
 * "Xero isn't connected" - the one notice the hub's Settings tabs show where a card needs Xero
 * (owner, 2026-11-12: Petty Cash Settings drew it grey, Payment Settings red; this is Payment
 * Settings' design). The link is the company's Integration tab, where Xero is connected.
 */
export function XeroNotConnected({ href }: { href: string }) {
  return (
    <div
      role="status"
      data-xero-not-connected
      className="flex items-start gap-2 rounded-[12px] border border-set-danger-line/40 bg-set-warn-bg px-4 py-3 text-[13px] text-set-ink-2"
    >
      {/* `!`: material-symbols' own CSS (unlayered) sets 24px over any utility. */}
      <span
        className="material-symbols-outlined shrink-0 text-[18px]! leading-5! text-danger"
        aria-hidden
      >
        link_off
      </span>
      <span className="min-w-0">
        Xero isn&apos;t connected. Connect it in{" "}
        <a
          href={href}
          className="font-semibold text-set-tab-ink underline underline-offset-2 hover:text-set-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-set-tab"
        >
          Integration
        </a>{" "}
        to set these up.
      </span>
    </div>
  );
}
