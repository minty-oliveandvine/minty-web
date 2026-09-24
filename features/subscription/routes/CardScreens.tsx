"use client";

/**
 * The billing page's two card screens, composed (Figma 08-Y "Add Card Details" and 08-D "Edit
 * Card Details"): the banner, one narrow card with the form, and Minty holding the cards under
 * it. Adding mounts Stripe's own fields (`CardCaptureForm`); editing draws three fields of our
 * own, because the only things Stripe lets a saved card change are the name on it and when it
 * expires - the number is shown, masked and disabled, so its absence does not read as a bug.
 */

import Image from "next/image";

import { CardCapturePanel } from "@/features/subscription/components/CardCaptureForm";
import { PortalHero } from "@/features/subscription/components/PortalHero";
import {
  ADD_CARD_HEADING,
  ADD_CARD_TITLE,
  EDIT_CARD_FOOT,
  EDIT_CARD_HEADING,
  EDIT_CARD_NOTE,
  EDIT_CARD_TITLE,
  STRIPE_NOTE,
} from "@/features/subscription/lib/billing";
import { useAddCard, useEditCard } from "@/features/subscription/hooks/useCardForm";

const SHEET =
  "mx-auto flex w-full max-w-[490px] flex-col gap-4 rounded-xl border border-[#eef1f4] bg-white px-7 py-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]";
const FIELD =
  "h-11 w-full rounded-lg border border-[#d8dee4] px-3.5 text-[15px] text-[#16202e] outline-none focus:border-[#2e9b9b]";
const LABEL = "text-[13px] font-semibold text-[#16202e]";

function MintyWithCards() {
  return (
    <Image
      src="/portal/minty-cards.png"
      alt=""
      width={160}
      height={232}
      unoptimized
      className="mx-auto mt-2"
    />
  );
}

export function AddCardScreen({ fixture }: { fixture?: string | null }) {
  const add = useAddCard({ fixture });
  return (
    <div className="flex flex-col gap-8 pb-16">
      <PortalHero title={ADD_CARD_TITLE} />
      <section aria-label={ADD_CARD_HEADING} className={SHEET}>
        <div>
          <h2 className="text-[17px] font-bold text-[#16202e]">{ADD_CARD_HEADING}</h2>
          <p className="mt-1.5 text-[13px] text-[#8b93a0]">{STRIPE_NOTE}</p>
        </div>
        <CardCapturePanel setup={add} onSaved={add.saved} onCancel={add.cancel} />
      </section>
      <MintyWithCards />
    </div>
  );
}

export function EditCardScreen({
  cardId,
  fixture,
}: {
  cardId?: string | null;
  fixture?: string | null;
}) {
  const edit = useEditCard({ cardId, fixture });
  return (
    <div className="flex flex-col gap-8 pb-16">
      <PortalHero title={EDIT_CARD_TITLE} />
      <section aria-label={EDIT_CARD_HEADING} className={SHEET}>
        <div>
          <h2 className="text-[17px] font-bold text-[#16202e]">{EDIT_CARD_HEADING}</h2>
          <p className="mt-1.5 text-[13px] text-[#8b93a0]">{EDIT_CARD_NOTE}</p>
        </div>

        {edit.status === "error" ? (
          <p role="alert" className="text-[15px] text-[#b42318]">
            {edit.error}
          </p>
        ) : edit.status === "loading" || !edit.card ? (
          <p role="status" className="py-6 text-center text-[15px] text-[#8b93a0]">
            Loading…
          </p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void edit.save();
            }}
          >
            <div>
              <label className={LABEL} htmlFor="card-number">
                Card number
              </label>
              <input
                id="card-number"
                className={`${FIELD} mt-1.5 bg-[#f2f4f7] text-[#8b93a0]`}
                value={`•••• •••• •••• ${edit.card.last4 ?? "••••"}`}
                disabled
                readOnly
              />
            </div>
            <div>
              <span className={LABEL}>Expiry date</span>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  aria-label="Expiry month"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  value={edit.fields.expMonth}
                  onChange={(e) => edit.setField("expMonth", e.target.value)}
                  className={`${FIELD} w-20 text-center`}
                />
                <span className="text-[#8b93a0]">/</span>
                <input
                  aria-label="Expiry year"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="YY"
                  value={edit.fields.expYear}
                  onChange={(e) => edit.setField("expYear", e.target.value)}
                  className={`${FIELD} w-20 text-center`}
                />
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="card-name">
                Name on card
              </label>
              <input
                id="card-name"
                className={`${FIELD} mt-1.5`}
                value={edit.fields.name}
                onChange={(e) => edit.setField("name", e.target.value)}
              />
            </div>
            <p className="text-[13px] leading-relaxed text-[#8b93a0]">{EDIT_CARD_FOOT}</p>
            {edit.saveError && (
              <p role="alert" className="text-[13px] text-[#b42318]">
                {edit.saveError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={edit.cancel}
                disabled={edit.busy}
                className="h-[44px] w-[104px] rounded-lg border border-[#d8dee4] bg-white text-[15px] font-semibold text-[#292e38] hover:bg-[#f5f7fa] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={edit.busy || !edit.dirty}
                className="h-[44px] w-[150px] rounded-lg bg-[#4fc7c7] text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {edit.busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </section>
      <MintyWithCards />
    </div>
  );
}
