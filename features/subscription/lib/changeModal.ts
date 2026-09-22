/**
 * What the confirmation ASKS before a change is applied - Figma section 06 ("Confirm modals —
 * every button that costs money asks first, and names the module"). One modal per pending
 * screen of 05·B, because the sentence depends on what each module is doing; the section's
 * frames (PU/PV/PW + the 05·B frame they follow) reduce to seven shapes, read off the ticks:
 *
 * - a removal beside an addition → "Subscription Changes" (C-01): what leaves and what arrives;
 * - a removal leaving nothing ticked → "Cancel Subscription?" (B-06), the red button;
 * - a removal while the other module stays → "Remove <Module>?" (B-05), the orange button;
 * - additions leaving both ticked → "You have unlocked <bundle>" (B-07);
 * - one addition: a trial confirmed or an expired trial bought back → "Activate <Module>"
 *   (B-01); a cancellation resumed → "Continue <Module>" (B-04); a suspension reactivated →
 *   "Reactivating <Module>" (B-03).
 *
 * (B-02, the free trial, is the list's own Start Trial dialog, 04-G.) The copy is the design's;
 * "another 30 days" is the prorated rule's floor (access until the later of the period end and
 * thirty days out), and the result screen then names the exact day. Pure.
 */

import type {
  ModuleCard,
  ModuleCode,
  ModulePage,
} from "@/features/subscription/api/moduleSettings";
import type { ModuleRef, ResultPart } from "@/features/subscription/lib/changeResult";
import { tickOf, type PlanTone } from "@/features/subscription/lib/subscriptionSummary";

export type ModalKind =
  "activate" | "reactivate" | "continue" | "remove" | "cancel_subscription" | "bundle" | "changes";

export type ModalImage = "celebrating" | "surprised" | "sad" | "super";

export type ConfirmTone = "teal" | "orange" | "red";

export type ChangeModal = {
  kind: ModalKind;
  /** "Remove" + Petty Cash (in its colour) + "?"; "You have unlocked" + the bundle (teal). */
  title: { lead: string; module: ModuleRef | null; tail: string };
  image: ModalImage;
  paragraphs: ResultPart[][];
  confirmLabel: string;
  confirmTone: ConfirmTone;
};

export const CONFIRM = "Confirm";
export const CONFIRM_CHANGE = "Confirm Change";
export const CONFIRM_CHANGES = "Confirm Changes";
export const CONFIRM_CANCELLATION = "Confirm Cancellation";
export const GO_BACK = "Go back";

const TONE: Record<ModuleCode, PlanTone> = { PETTY_CASH: "petty", PAYMENT_REQUEST: "payment" };

function ref(card: ModuleCard): ModuleRef {
  return { code: card.code, name: card.name, tone: TONE[card.code] ?? "none" };
}

const plain = (text: string): ResultPart => ({ text, style: "plain" });
const strong = (text: string): ResultPart => ({ text, style: "strong" });
const named = (m: ModuleRef): ResultPart => ({ text: m.name, style: m.tone });

/** The modal for the change the ticks describe: the cards changed, by code. */
export function buildChangeModal(page: ModulePage, codes: ModuleCode[]): ChangeModal | null {
  const changed = codes
    .map((code) => page.cards.find((c) => c.code === code))
    .filter((c): c is ModuleCard => c !== undefined)
    .map((card) => ({ card, ...tickOf(card) }))
    .filter((c) => c.seam !== null);
  if (changed.length === 0) return null;

  const removed = changed.filter((c) => c.seam === "cancel");
  const added = changed.filter((c) => c.seam !== "cancel");
  // Ticked once the change is made: every card's own tick, flipped where it changed.
  const changedCodes = new Set(changed.map((c) => c.card.code));
  const tickedAfter = page.cards.filter((card) => {
    const own = tickOf(card).tick === "ticked";
    return changedCodes.has(card.code) ? !own : own;
  });

  if (removed.length > 0 && added.length > 0) {
    const paragraph: ResultPart[] = [];
    for (const r of removed) {
      paragraph.push(
        named(ref(r.card)),
        plain(" will be "),
        strong("removed"),
        plain(". You'll continue to have access for another 30 days. "),
      );
    }
    for (const a of added) {
      paragraph.push(
        named(ref(a.card)),
        plain(" will be "),
        strong("added"),
        plain(". You'll have access immediately."),
      );
    }
    return {
      kind: "changes",
      title: { lead: "Subscription Changes", module: null, tail: "" },
      image: "surprised",
      paragraphs: [paragraph],
      confirmLabel: CONFIRM_CHANGES,
      confirmTone: "orange",
    };
  }

  if (removed.length > 0) {
    if (tickedAfter.length === 0) {
      return {
        kind: "cancel_subscription",
        title: { lead: "Cancel Subscription?", module: null, tail: "" },
        image: "sad",
        paragraphs: [
          [plain("No modules are selected.")],
          [plain("Your Minty subscription will be cancelled after 30 days.")],
        ],
        confirmLabel: CONFIRM_CANCELLATION,
        confirmTone: "red",
      };
    }
    const m = ref(removed[0].card);
    return {
      kind: "remove",
      title: { lead: "Remove", module: m, tail: "?" },
      image: "surprised",
      paragraphs: [
        [plain(`You've chosen to remove ${m.name}. You'll still have access for another 30 days.`)],
        [
          plain(
            "Your other module will stay active, and your subscription fee will be updated accordingly.",
          ),
        ],
      ],
      confirmLabel: CONFIRM_CHANGE,
      confirmTone: "orange",
    };
  }

  if (tickedAfter.length >= 2 && page.cards.length >= 2) {
    const bundle = page.summary?.bundle_name || "Super Minty";
    return {
      kind: "bundle",
      title: {
        lead: "You have unlocked",
        module: { code: "PETTY_CASH", name: bundle, tone: "bundle" },
        tail: "",
      },
      image: "super",
      paragraphs: [
        [plain("You’ve activated both modules.")],
        [plain("Enjoy bundled pricing and access to all available modules.")],
      ],
      confirmLabel: CONFIRM,
      confirmTone: "teal",
    };
  }

  const only = added[0];
  const m = ref(only.card);
  switch (only.seam) {
    case "resume":
      return {
        kind: "continue",
        title: { lead: "Continue", module: m, tail: "" },
        image: "celebrating",
        paragraphs: [
          [plain(`${m.name} will remain in your subscription.`)],
          [plain("Your scheduled cancellation will be removed.")],
        ],
        confirmLabel: CONFIRM,
        confirmTone: "teal",
      };
    case "reactivate":
      return {
        kind: "reactivate",
        title: { lead: "Reactivating", module: m, tail: "" },
        image: "celebrating",
        paragraphs: [
          [plain(`${m.name} will be reactivated.`)],
          [plain("Your subscription billing will resume.")],
        ],
        confirmLabel: CONFIRM,
        confirmTone: "teal",
      };
    default:
      return {
        kind: "activate",
        title: { lead: "Activate", module: m, tail: "" },
        image: "celebrating",
        paragraphs: [[plain(`You've chosen to activate ${m.name}.`)]],
        confirmLabel: CONFIRM,
        confirmTone: "teal",
      };
  }
}
