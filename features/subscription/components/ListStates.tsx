/**
 * The list's four non-list states (Figma 04-B, 04-C, 04-D, 04-E): nothing paid for, a search
 * that matched nothing, skeleton rows while loading ("not a spinner - the table keeps its shape
 * so nothing jumps"), and could-not-load with a retry ("an empty table here would read as 'you
 * pay for nothing', which is a worse lie than an error you can retry from").
 */

import Image from "next/image";

const CARD =
  "flex flex-col items-center rounded-xl border border-[#e5ebed] bg-white px-6 text-center shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]";
const TITLE = "text-[25px] font-bold leading-[42px] text-ink";
const BODY = "max-w-[640px] text-base leading-[26px] text-[var(--ink-soft)]";
const BUTTON = "rounded-xl bg-[#4fc7c7] text-[17px] font-semibold text-white hover:opacity-90";

export function ListEmpty({ entityListHref }: { entityListHref: string }) {
  return (
    <div className={`${CARD} min-h-[470px] justify-center gap-4 py-8`}>
      <Image src="/portal/cat-empty.png" alt="" width={180} height={195} unoptimized />
      <p className={TITLE}>You&apos;re not paying for anything yet.</p>
      <p className={BODY}>
        A company appears here once you start a trial or a subscription for it.
        <br />
        If you belong to a company that is already paid for, someone else is the subscriber — their
        name is on that company’s subscription page.
      </p>
      <a
        href={entityListHref}
        className={`${BUTTON} mt-2 flex h-14 w-[260px] items-center justify-center`}
      >
        Go to entity list
      </a>
    </div>
  );
}

export function ListNoMatch() {
  return (
    <div className={`${CARD} min-h-[400px] justify-center gap-3 py-8`} role="status">
      <Image src="/portal/cat-no-match.png" alt="" width={130} height={176} unoptimized />
      <p className={TITLE}>Nothing matched that.</p>
      <p className={BODY}>Try a company name, a country, or a status like “free trial”.</p>
    </div>
  );
}

export function ListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={`${CARD} min-h-[400px] justify-center gap-4 py-8`} role="alert">
      <span
        aria-hidden
        className="flex size-[78px] items-center justify-center rounded-full bg-[#ffecec] text-[40px] font-bold leading-none text-[#dc5a5a]"
      >
        !
      </span>
      <p className={TITLE}>We couldn’t load your subscriptions.</p>
      <p className={BODY}>{message}</p>
      <button type="button" onClick={onRetry} className={`${BUTTON} h-[54px] w-[210px]`}>
        Try again
      </button>
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-[29px]" role="status" aria-label="Loading your subscriptions">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="grid min-h-[125px] animate-pulse grid-cols-[minmax(200px,1.3fr)_1fr_1fr_auto] items-center gap-6 rounded-xl bg-white px-7 py-5 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]"
        >
          <span className="h-5 w-[300px] max-w-full rounded bg-gray-200" />
          <span className="flex items-center gap-6">
            <span className="size-[76px] rounded-full bg-gray-100" />
            <span className="h-[18px] w-[130px] rounded bg-gray-200" />
          </span>
          <span className="flex items-center gap-6">
            <span className="size-[76px] rounded-full bg-gray-100" />
            <span className="h-[18px] w-[130px] rounded bg-gray-200" />
          </span>
          <span className="w-[88px]" />
        </li>
      ))}
    </ul>
  );
}
