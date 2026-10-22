// The open row's view (Figma 05·A) from the API's page model: what each card shows and which
// tick it gets, the plan names and prices the panel prints, when it splits into current and
// future, the payment method, and the footer's two dates - one frame per rule. Then 05·B: the
// same view with a tick pending - the chip, the future the ticks say, the confirm button.

import { formatPrice } from "@minty/shared/money";
import { describe, expect, it } from "vitest";

import {
  SUMMARY_FIXTURES,
  TODAY,
  WALLET,
  type SummaryFrame,
} from "@/features/subscription/__fixtures__/modulePage";
import { ENTITIES } from "@/features/subscription/__fixtures__/subscriptions";
import type { ModulePage } from "@/features/subscription/api/moduleSettings";
import {
  NO_MODULE,
  NO_MODULES,
  TRIAL_NO_CHARGE,
  buildSummaryView,
  forecast,
  longDate,
  pageFromList,
  shortDate,
  tickOf,
  toggleTick,
  utcDay,
  type PendingTicks,
} from "@/features/subscription/lib/subscriptionSummary";

const ENTITY = { created_at: "2025-09-11T02:00:00+00:00" };

const view = (frame: SummaryFrame, page: ModulePage = SUMMARY_FIXTURES[frame]) =>
  buildSummaryView(page, ENTITY, WALLET, TODAY);

const ticks = (frame: SummaryFrame) => view(frame).modules.map((m) => [m.code, m.tick, m.seam]);

// owner 2026-10-21: one money rule (@minty/shared/money). The panel's prices were this file's
// own formatMoney(symbol, n) ("HKD 400"); they are formatPrice(n, code) now - the ISO code, one
// space, the number, a trailing ".00" dropped. Never a symbol.
describe("formatPrice, as the panel prints a price", () => {
  it("the code, a non-breaking space, cents only when they mean something", () => {
    expect(formatPrice(400, "HKD")).toBe("HKD\u00a0400");
    expect(formatPrice(400.5, "HKD")).toBe("HKD\u00a0400.50");
    expect(formatPrice(280, "HKD")).toBe("HKD\u00a0280");
    expect(formatPrice(0, "")).toBe("0");
  });

  it("groups the thousands as the API does - it once printed 1200 beside the API's 1,200", () => {
    expect(formatPrice(1500, "HKD")).toBe("HKD\u00a01,500");
    expect(formatPrice(1695.09, "HKD")).toBe("HKD\u00a01,695.09");
    expect(formatPrice(1234567.5, "HKD")).toBe("HKD\u00a01,234,567.50");
  });

  it("the forecast reads the summary's CODE, so a symbol in `currency` can never show", () => {
    const page = SUMMARY_FIXTURES.M44;
    const legacy = {
      ...page,
      summary: { ...page.summary!, currency: "HK$", currency_code: "HKD" },
    };
    expect(forecast(legacy, TODAY).currency).toBe("HKD");
    const noCode = { ...page, summary: { ...page.summary!, currency: "HKD", currency_code: null } };
    expect(forecast(noCode, TODAY).currency).toBe("HKD");
  });
});

describe("utcDay", () => {
  it("reads an ISO prefix, and the portal's RFC 822 too", () => {
    // The prefix is taken as written: an offset must not slide the day it names.
    expect(utcDay("2026-10-18")).toEqual(new Date(Date.UTC(2026, 9, 18)));
    expect(utcDay("2026-10-18T23:00:00+08:00")).toEqual(new Date(Date.UTC(2026, 9, 18)));
    // What the payer portal actually sends. Every date on the handover screens arrives
    // like this, and reading only ISO dropped all of them against the real API.
    expect(utcDay("Sun, 18 Oct 2026 12:00:00 GMT")).toEqual(new Date(Date.UTC(2026, 9, 18)));
    expect(utcDay(null)).toBeNull();
    expect(utcDay("")).toBeNull();
    expect(utcDay("whenever")).toBeNull();
  });
});

describe("pageFromList", () => {
  it("draws the company's cards from what the list knows of it", () => {
    const orchid = ENTITIES.find((e) => e.entity_name === "Orchid Lane Limited")!;
    const page = pageFromList(orchid);
    expect(page.entity_id).toBe(orchid.entity_id);
    expect(page.summary).toBeNull();
    const view = buildSummaryView(page, orchid, null, TODAY);
    expect(view.modules.map((m) => [m.code, m.view.state, m.tick, m.seam])).toEqual([
      ["PETTY_CASH", "trial_eligible", "start_trial", null],
      ["PAYMENT_REQUEST", "pending_cancel", "unticked", "resume"],
    ]);
    const states = ENTITIES.flatMap((e) =>
      buildSummaryView(pageFromList(e), e, null, TODAY).modules.map((m) => m.view.state),
    );
    // every list status the fixtures use draws as a card state
    expect(new Set(states)).toEqual(
      new Set(["trial_eligible", "trialing", "expired", "active", "pending_cancel", "past_due"]),
    );
  });
});

describe("the cards and their ticks", () => {
  it("M11: nothing started - two Start Free Trial buttons", () => {
    expect(ticks("M11")).toEqual([
      ["PETTY_CASH", "start_trial", null],
      ["PAYMENT_REQUEST", "start_trial", null],
    ]);
    const v = view("M11");
    expect(v.modules[0].view.status.text).toBe("30 days trial available");
    expect(v.modules[0].view.live).toBe(false);
  });

  it("M21: a running trial is unticked (confirm it) and drawn plain; the ⓘ line shows", () => {
    expect(ticks("M21")).toEqual([
      ["PETTY_CASH", "unticked", "confirm_trial"],
      ["PAYMENT_REQUEST", "start_trial", null],
    ]);
    const v = view("M21");
    expect(v.trialNotice).toBe(true);
    expect(v.modules[0].view.live).toBe(false);
    expect(v.modules[0].view.status).toMatchObject({ eyebrow: "Trial", text: "3 days remaining" });
  });

  it("N21a: a confirmed trial is ticked, live, and still counting", () => {
    expect(ticks("N21a")[0]).toEqual(["PETTY_CASH", "ticked", "cancel"]);
    const v = view("N21a");
    expect(v.modules[0].view.live).toBe(true);
    expect(v.modules[0].view.status.text).toBe("3 days remaining");
    expect(v.trialNotice).toBe(true);
  });

  it("M31: an expired trial is unticked (subscribe)", () => {
    expect(ticks("M31")[0]).toEqual(["PETTY_CASH", "unticked", "subscribe"]);
    expect(view("M31").modules[0].view.status.text).toBe("Trial Expired");
  });

  it("M44: active is ticked and reads one word, and a press means cancel", () => {
    expect(ticks("M44")).toEqual([
      ["PETTY_CASH", "ticked", "cancel"],
      ["PAYMENT_REQUEST", "ticked", "cancel"],
    ]);
    expect(view("M44").modules[0].view.status.text).toBe("Active");
    expect(view("M44").trialNotice).toBe(false);
  });

  it("M51: a cancellation pending is unticked (resume) and counts down to its end", () => {
    expect(ticks("M51")[0]).toEqual(["PETTY_CASH", "unticked", "resume"]);
    expect(view("M51").modules[0].view.status).toMatchObject({
      eyebrow: "Cancellation pending",
      text: "Ends in 15 days",
    });
  });

  it("M61: suspended is unticked (reactivate)", () => {
    expect(ticks("M61")[0]).toEqual(["PETTY_CASH", "unticked", "reactivate"]);
    expect(view("M61").modules[0].view.status.text).toBe("Subscription Suspended");
  });

  it("tickOf never throws on a card the API left bare", () => {
    const bare = { ...SUMMARY_FIXTURES.M11.cards[0], trial_eligible: false };
    expect(tickOf(bare)).toEqual({ tick: "unticked", seam: "subscribe" });
  });
});

describe("the panel", () => {
  it("M11: no module selected, HKD 0, greyed, no pending changes", () => {
    const p = view("M11").panel;
    expect(p).toEqual({
      kind: "simple",
      lines: [{ name: NO_MODULE, tone: "none", tag: null }],
      price: "HKD\u00a00",
      greyed: true,
    });
  });

  it("M21: a trial is the selected plan at HKD 0, tagged Free Trial", () => {
    const p = view("M21").panel;
    expect(p).toMatchObject({
      kind: "simple",
      lines: [{ name: "Petty Cash", tone: "petty", tag: "(Free Trial)" }],
      price: "HKD\u00a00",
      greyed: true,
    });
  });

  it("M44: both active is the bundle at its price, nothing greyed", () => {
    const p = view("M44").panel;
    expect(p).toEqual({
      kind: "simple",
      lines: [{ name: "Super Minty", tone: "bundle", tag: null }],
      price: "HKD\u00a0400",
      greyed: false,
    });
  });

  it("M45: one active, one cancelling - current (the bundle, singles struck) then the survivor only", () => {
    const p = view("M45").panel;
    expect(p.kind).toBe("changing");
    if (p.kind !== "changing") return;
    expect(p.current).toMatchObject({
      heading: "Current Subscription",
      lines: [
        { name: "Petty Cash", tone: "petty", tag: "(Active)" },
        { name: "Payment Request", tone: "payment", tag: "(Cancellation in progress)" },
      ],
      price: "HKD\u00a0400",
      struck: "HKD\u00a0560",
      note: null,
      greyed: true,
    });
    expect(p.future).toMatchObject({
      heading: "Future Subscription",
      lines: [{ name: "Petty Cash", tone: "petty", tag: "only" }],
      price: "HKD\u00a0280",
      struck: null,
      greyed: false,
    });
    // Until the cancelling module's period end; from the day after.
    const end = SUMMARY_FIXTURES.M45.cards[1].period_end as string;
    const until = new Date(end.slice(0, 10) + "T00:00:00Z");
    expect(p.current.dateLine).toBe(`Until ${longDate(until)}`);
    expect(p.future?.dateLine).toBe(`From ${longDate(new Date(until.getTime() + 86_400_000))}`);
  });

  it("M51: cancelling the only module leaves an empty future", () => {
    const p = view("M51").panel;
    expect(p.kind).toBe("changing");
    if (p.kind !== "changing") return;
    expect(p.current.lines).toEqual([
      { name: "Petty Cash", tone: "petty", tag: "(Cancellation in progress)" },
    ]);
    expect(p.current.price).toBe("HKD\u00a0280");
    expect(p.current.struck).toBeNull();
    expect(p.future?.lines).toEqual([{ name: NO_MODULES, tone: "none", tag: null }]);
    expect(p.future?.price).toBe("HKD\u00a00");
  });

  it("N21a: a confirmed trial - HKD 0 now with the no-charge note, its price from the day after", () => {
    const p = view("N21a").panel;
    expect(p.kind).toBe("changing");
    if (p.kind !== "changing") return;
    expect(p.current).toMatchObject({
      lines: [{ name: "Petty Cash", tone: "petty", tag: "(Free Trial)" }],
      price: "HKD\u00a00",
      note: TRIAL_NO_CHARGE,
    });
    expect(p.future).toMatchObject({
      lines: [{ name: "Petty Cash", tone: "petty", tag: "only" }],
      price: "HKD\u00a0280",
    });
  });

  it("M61: a suspended module is not billable", () => {
    expect(view("M61").panel).toMatchObject({ kind: "simple", price: "HKD\u00a00", greyed: true });
  });

  it("names the currency the summary gives, and falls back to the cards' code", () => {
    const page: ModulePage = {
      ...SUMMARY_FIXTURES.M44,
      summary: { ...SUMMARY_FIXTURES.M44.summary!, currency: "HKD" },
    };
    expect(buildSummaryView(page, ENTITY, null, TODAY).panel).toMatchObject({
      price: "HKD\u00a0400",
    });
    const bare: ModulePage = { ...SUMMARY_FIXTURES.M44, summary: null };
    // Without the bundle's price the two singles simply add up.
    expect(buildSummaryView(bare, ENTITY, null, TODAY).panel).toMatchObject({
      price: "HKD\u00a0560",
      lines: [
        { name: "Petty Cash", tag: null },
        { name: "Payment Request", tag: null },
      ],
    });
  });
});

describe("the payment method and the footer", () => {
  it("names the nominated card and says how to change it; none when nothing is nominated", () => {
    expect(view("M44").paymentMethod).toEqual({
      brand: "Visa",
      network: "visa",
      last4: "4121",
      label: "Visa 4121",
    });
    expect(buildSummaryView(SUMMARY_FIXTURES.M44, ENTITY, null, TODAY).paymentMethod).toBeNull();
    expect(
      buildSummaryView(SUMMARY_FIXTURES.M44, ENTITY, { ...WALLET, nominated_id: null }, TODAY)
        .paymentMethod,
    ).toBeNull();
  });

  it("dates the company's creation and the next renewal the panel knows", () => {
    const v = view("M44");
    expect(v.footer.createdOn).toBe(shortDate(new Date("2025-09-11T00:00:00Z")));
    expect(v.footer.renewalOn).toBe(SUMMARY_FIXTURES.M44.panel?.next_invoice?.date);
    // Nothing started at all: no trial to convert, so no renewal to state; and with no
    // created_at there is no first sentence either.
    expect(view("M11").footer.renewalOn).toBeNull();
    expect(buildSummaryView(SUMMARY_FIXTURES.M11, null, null, TODAY).footer.createdOn).toBeNull();
  });

  it("with only a trial running, the renewal date is the day that trial ends", () => {
    // The API withholds `next_invoice` until a company has a billing cycle ("Absent while the
    // entity has only trials"), but the trial's end IS the day billing would begin.
    expect(SUMMARY_FIXTURES.M21.panel?.next_invoice).toBeNull();
    const end = utcDay(SUMMARY_FIXTURES.M21.cards[0].period_end)!;
    expect(view("M21").footer.renewalOn).toBe(shortDate(end));

    // Two trials: the nearer one, which is what "your next" means.
    const ends = SUMMARY_FIXTURES.M22.cards.map((c) => utcDay(c.period_end)!.getTime());
    expect(view("M22").footer.renewalOn).toBe(shortDate(new Date(Math.min(...ends))));

    // A trial already cancelled will not renew, so it names nothing.
    const cancelled = {
      ...SUMMARY_FIXTURES.M21,
      cards: SUMMARY_FIXTURES.M21.cards.map((c) =>
        c.code === "PETTY_CASH" ? { ...c, trial_cancelled: true } : c,
      ),
    };
    expect(buildSummaryView(cancelled, ENTITY, WALLET, TODAY).footer.renewalOn).toBeNull();
  });

  it("the row says the same date while it loads as it does once loaded", () => {
    // The open row draws its footer from `pageFromList` until the page model lands. That model
    // carries no pre-formatted dates, so a date taken from one would change spelling under the
    // reader mid-load; written here, both models agree.
    const trialing = ENTITIES.find((e) =>
      e.modules.some((m) => m.status === "trialing" && m.date_iso),
    )!;
    const loading = buildSummaryView(pageFromList(trialing), trialing, null, TODAY);
    const soonest = trialing.modules
      .filter((m) => m.status === "trialing" && m.date_iso)
      .map((m) => utcDay(m.date_iso)!)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    expect(loading.footer.renewalOn).toBe(shortDate(soonest));
  });
});

describe("a tick pending (05·B)", () => {
  const withTicks = (frame: SummaryFrame, pending: PendingTicks) =>
    buildSummaryView(SUMMARY_FIXTURES[frame], ENTITY, WALLET, TODAY, pending);

  it("V44: unticking an active module - Removing, the bundle now, the survivor only, confirm = cancel", () => {
    const v = withTicks("M44", { PETTY_CASH: false });
    const [pc, pr] = v.modules;
    expect(pc).toMatchObject({ tick: "unticked", chip: "Removing", changed: true });
    expect(pc.view.live).toBe(false);
    expect(pr).toMatchObject({ tick: "ticked", chip: null, changed: false });
    expect(v.panel.kind).toBe("changing");
    if (v.panel.kind !== "changing") return;
    expect(v.panel.current).toMatchObject({
      lines: [{ name: "Super Minty", tone: "bundle" }],
      price: "HKD\u00a0400",
      struck: "HKD\u00a0560",
    });
    expect(v.panel.future).toMatchObject({
      lines: [{ name: "Payment Request", tag: "only" }],
      price: "HKD\u00a0280",
    });
    expect(v.pendingChange).toEqual({ code: "PETTY_CASH", seam: "cancel", codes: ["PETTY_CASH"] });
  });

  it("U44: unticking both - no modules selected after the period end", () => {
    const v = withTicks("M44", { PETTY_CASH: false, PAYMENT_REQUEST: false });
    expect(v.modules.map((m) => m.chip)).toEqual(["Removing", "Removing"]);
    if (v.panel.kind !== "changing") throw new Error(v.panel.kind);
    expect(v.panel.future?.lines).toEqual([{ name: NO_MODULES, tone: "none", tag: null }]);
    expect(v.panel.future?.price).toBe("HKD\u00a00");
    expect(v.pendingChange?.codes).toEqual(["PETTY_CASH", "PAYMENT_REQUEST"]);
  });

  it("V21: ticking a running trial - Adding, teal, HKD 0 now with the note, its price after", () => {
    const v = withTicks("M21", { PETTY_CASH: true });
    expect(v.modules[0]).toMatchObject({ tick: "ticked", chip: "Adding", changed: true });
    expect(v.modules[0].view.live).toBe(true);
    if (v.panel.kind !== "changing") throw new Error(v.panel.kind);
    expect(v.panel.current).toMatchObject({
      lines: [{ name: "Petty Cash", tag: "(Free Trial)" }],
      price: "HKD\u00a00",
      note: TRIAL_NO_CHARGE,
    });
    expect(v.panel.future).toMatchObject({
      lines: [{ name: "Petty Cash", tag: "only" }],
      price: "HKD\u00a0280",
    });
    // The trial's end is the period end.
    const end = SUMMARY_FIXTURES.M21.cards[0].period_end as string;
    expect(v.panel.current.dateLine).toBe(
      `Until ${longDate(new Date(end.slice(0, 10) + "T00:00:00Z"))}`,
    );
    expect(v.pendingChange).toMatchObject({ code: "PETTY_CASH", seam: "confirm_trial" });
  });

  it("V31: ticking an expired trial - Adding, nothing now (and no date), its price after, confirm = subscribe", () => {
    const v = withTicks("M31", { PETTY_CASH: true });
    expect(v.modules[0]).toMatchObject({ tick: "ticked", chip: "Adding" });
    if (v.panel.kind !== "changing") throw new Error(v.panel.kind);
    expect(v.panel.current).toMatchObject({
      lines: [{ name: NO_MODULE, tone: "none" }],
      price: "HKD\u00a00",
      dateLine: null,
    });
    expect(v.panel.future).toMatchObject({
      lines: [{ name: "Petty Cash", tag: "only" }],
      price: "HKD\u00a0280",
      dateLine: null,
    });
    expect(v.pendingChange?.seam).toBe("subscribe");
  });

  it("V51 / V61: ticking a cancellation or a suspension - Restoring, confirm = resume / reactivate", () => {
    const resumed = withTicks("M51", { PETTY_CASH: true });
    expect(resumed.modules[0]).toMatchObject({ tick: "ticked", chip: "Restoring" });
    expect(resumed.pendingChange?.seam).toBe("resume");
    if (resumed.panel.kind !== "changing") throw new Error(resumed.panel.kind);
    expect(resumed.panel.future).toMatchObject({
      lines: [{ name: "Petty Cash", tag: "only" }],
      price: "HKD\u00a0280",
    });

    const restored = withTicks("M61", { PETTY_CASH: true });
    expect(restored.modules[0]).toMatchObject({ tick: "ticked", chip: "Restoring" });
    expect(restored.pendingChange?.seam).toBe("reactivate");
  });

  it("NX21a: unticking a confirmed trial - no chip, the trial now, no future to draw", () => {
    const v = withTicks("N21a", { PETTY_CASH: false });
    expect(v.modules[0]).toMatchObject({ tick: "unticked", chip: null, changed: true });
    expect(v.modules[0].view.live).toBe(false);
    if (v.panel.kind !== "changing") throw new Error(v.panel.kind);
    expect(v.panel.current).toMatchObject({
      lines: [{ name: "Petty Cash", tag: "(Free Trial)" }],
      price: "HKD\u00a00",
      note: TRIAL_NO_CHARGE,
    });
    expect(v.panel.future).toBeNull();
    expect(v.pendingChange).toMatchObject({ code: "PETTY_CASH", seam: "cancel" });
  });

  it("a tick that matches today's state is not a change", () => {
    const v = withTicks("M44", { PETTY_CASH: true });
    expect(v.modules[0].changed).toBe(false);
    expect(v.panel.kind).toBe("simple");
    expect(v.pendingChange).toBeNull();
  });

  it("toggleTick flips against today's tick and undoes on a second press; never for Start Free Trial", () => {
    const active = SUMMARY_FIXTURES.M44.cards[0];
    const never = SUMMARY_FIXTURES.M11.cards[1];
    let pending: PendingTicks = {};
    pending = toggleTick(pending, active);
    expect(pending).toEqual({ PETTY_CASH: false });
    pending = toggleTick(pending, active);
    expect(pending).toEqual({});
    expect(toggleTick(pending, never)).toEqual({});
    const trial = SUMMARY_FIXTURES.M21.cards[0];
    expect(toggleTick({}, trial)).toEqual({ PETTY_CASH: true });
  });
});

describe("longDate and shortDate, literally", () => {
  // Pins the en-GB date words before they move to @minty/shared (the shared-code refactor, 2026-10-21)
  it('longDate is "16 August 2026", read in UTC', () => {
    expect(longDate(new Date(Date.UTC(2026, 7, 16)))).toBe("16 August 2026");
    expect(longDate(new Date("2026-08-16T23:30:00Z"))).toBe("16 August 2026");
    expect(longDate(new Date(Date.UTC(2026, 0, 1)))).toBe("1 January 2026");
  });

  it("shortDate is en-GB's short month - FOUR letters for September, unpadded day", () => {
    expect(shortDate(new Date(Date.UTC(2025, 8, 11)))).toBe("11 Sept 2025");
    expect(shortDate(new Date(Date.UTC(2026, 5, 3)))).toBe("3 Jun 2026");
    expect(shortDate(new Date(Date.UTC(2026, 4, 9)))).toBe("9 May 2026");
  });
});
