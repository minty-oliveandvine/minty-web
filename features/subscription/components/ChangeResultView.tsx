"use client";

/**
 * Where a confirmed change lands (Figma 05·C, "After Confirm — the result screens"). Two
 * layouts of one `ChangeResult` (`lib/changeResult.ts`):
 *
 * - `ChangeResultRow` - the list with this company's row open: "Congratulations!" (or
 *   "Subscription updated", or 07-M's "Subscription Transfer Completed" with its sentences), a
 *   line per module, the line of money, Back to Manage Subscriptions, Minty celebrating, and
 *   the row's footer sentences (05·C-1/-5/-6, the RU/RV/RW frames).
 * - `ChangeResultPage` - the whole page for a cancellation: the banner retitled by the screen,
 *   one card with the ⋮, the headline, the company, three paragraphs, the button and Minty with
 *   a heart (05·C-2/-3).
 *
 * The button is the one way out: the hook drops the result, closes the row and reloads the list.
 */

import Image from "next/image";

import type { MenuItem } from "@/features/subscription/lib/portalRows";
import type { PortalEntity } from "@/features/subscription/api/payerPortal";
import {
  BACK_TO_LIST,
  type ChangeResult,
  type ResultPart,
} from "@/features/subscription/lib/changeResult";
import type { PlanTone } from "@/features/subscription/lib/subscriptionSummary";

import { RowMenu } from "@/features/subscription/components/RowMenu";

/** The module names' colours, as the summary panel paints them. */
export const PLAN_TONE: Record<PlanTone, string> = {
  petty: "text-[#ea9713]",
  payment: "text-[#2e6ff2]",
  bundle: "text-[#161f2e]",
  none: "text-[#161f2e]",
};

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="h-[66px] w-[368px] max-w-full rounded-[24px] bg-[#54d3da] text-xl font-bold text-white hover:opacity-90"
    >
      {BACK_TO_LIST}
    </button>
  );
}

function Part({ part }: { part: ResultPart }) {
  if (part.style === "plain") return <>{part.text}</>;
  if (part.style === "strong")
    return <strong className="font-normal text-[#333]">{part.text}</strong>;
  if (part.style === "company") return <span className="text-[#219994]">{part.text}</span>;
  return <span className={PLAN_TONE[part.style]}>{part.text}</span>;
}

export function ChangeResultRow({
  entity,
  result,
  menu,
  onMenu,
  onBack,
}: {
  entity: PortalEntity;
  result: ChangeResult;
  menu: MenuItem[];
  onMenu: (item: MenuItem) => void;
  onBack: () => void;
}) {
  const celebrate = result.kind === "celebrate" || result.kind === "transferred";
  return (
    <li
      data-entity={entity.entity_id}
      data-result={result.kind}
      className="flex flex-col gap-8 rounded-xl bg-white px-8 pb-8 pt-10 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="min-w-0 truncate text-[25px] font-bold text-black">{entity.entity_name}</h3>
        <RowMenu entityName={entity.entity_name} items={menu} onSelect={onMenu} />
      </div>

      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:px-12">
        <div className="flex flex-col gap-8">
          <h4
            className={`text-[40px] font-bold leading-tight ${celebrate ? "text-[#54d3da]" : "text-[#161f2e]"}`}
          >
            {result.headline.text}
          </h4>
          <div className="flex flex-col gap-1 text-xl text-black">
            {result.paragraphs.map((parts, i) => (
              <p key={i} className="text-[15px] text-[#737a87]">
                {parts.map((part, j) => (
                  <Part key={j} part={part} />
                ))}
              </p>
            ))}
            {result.lines.map((line) => (
              <p key={line.module.code} data-line={line.module.code}>
                <span className={`font-bold ${PLAN_TONE[line.module.tone]}`}>
                  {line.module.name}
                </span>
                {line.text.slice(line.module.name.length)}
              </p>
            ))}
            {result.money && (
              <p className="mt-4 font-bold text-[#737a87]" data-money>
                {result.money}
              </p>
            )}
          </div>
          <BackButton onBack={onBack} />
        </div>
        <Image
          src="/portal/minty-celebrating.png"
          alt=""
          width={300}
          height={360}
          unoptimized
          className="justify-self-center"
        />
      </div>

      <div className="flex flex-col gap-3 text-[15px] text-quiet">
        {result.footer.createdOn && (
          <p>
            Minty for <span className="text-[#219994]">{entity.entity_name}</span> was originally
            created {result.footer.createdOn}.
          </p>
        )}
        {result.footer.renewalOn && (
          <p>
            Your next subscription renewal date is {result.footer.renewalOn} and each month after.
            Minty subscriptions auto-renew monthly until cancellation is initiated. There is a 1
            month notice period required for your cancellation.
          </p>
        )}
      </div>
    </li>
  );
}

export function ChangeResultPage({
  entity,
  result,
  menu,
  onMenu,
  onBack,
}: {
  entity: PortalEntity;
  result: ChangeResult;
  menu: MenuItem[];
  onMenu: (item: MenuItem) => void;
  onBack: () => void;
}) {
  return (
    <section
      aria-label={result.hero ?? result.headline.text}
      data-result={result.kind}
      data-entity={entity.entity_id}
      className="relative rounded-xl bg-white px-8 pb-16 pt-14 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]"
    >
      <div className="absolute right-8 top-8">
        <RowMenu entityName={entity.entity_name} items={menu} onSelect={onMenu} />
      </div>
      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:px-12">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-[40px] font-bold leading-tight text-[#54d3da]">
              {result.headline.module && (
                <span className={PLAN_TONE[result.headline.module.tone]}>
                  {result.headline.module.name}
                </span>
              )}
              {result.headline.text}
            </h2>
            <p className="text-2xl text-[#ea9713]">{result.company}</p>
          </div>
          <div className="flex max-w-[520px] flex-col gap-4 pl-6 text-[15px] text-[#98a2b3]">
            {result.paragraphs.map((parts, i) => (
              <p key={i}>
                {parts.map((part, j) => (
                  <Part key={j} part={part} />
                ))}
              </p>
            ))}
          </div>
          <BackButton onBack={onBack} />
        </div>
        <Image
          src="/portal/minty-heart.png"
          alt=""
          width={313}
          height={404}
          unoptimized
          className="justify-self-center"
        />
      </div>
    </section>
  );
}
