// Payment Settings as a person sees it (moved from minty-payment-request-web, owner 2026-11-10):
// the account-code card in the hub's settings page. Ported from that app's
// components/settings/__tests__/AccountCodeSettings.test.tsx and SettingsContent.test.tsx - the
// Xero-less card reading nothing at all, the at-least-one rule, the ON-before-OFF ordering of a
// save, a partial failure leaving the saved set where the server left it, the view-only lines -
// plus the hub's chrome and this page's leave guard. minty-payment-request-api is answered per
// path and method; every call must name the company with X-Entity-Id.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DISCARD_CHANGES, GO_BACK_UPPER, LEAVE_TITLE } from "@/components/ui/LeaveDialog";
import { SETTINGS_PRIMARY } from "@/components/ui/settingsButtons";
import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import type { EntityBillAccount } from "@/features/payment-settings/api/paymentSettings";
import { PaymentSettingsScreen } from "@/features/payment-settings/routes/PaymentSettingsScreen";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/entity/360812e1/olive-and-vine/settings/payment",
}));

const ID = "360812e1-9f3a-4c21-8e5b-1a2b3c4d5e6f";
const NAME = "Olive & Vine";
const COMPANY = { id: ID, name: NAME };
const API = env.PAYMENT_REQUEST_API_URL;
const INTEGRATION_HREF = "/entity/360812e1/olive-and-vine/settings/integration";

/** Two ticked, one not - the same three codes the e2e spec stubs. */
const ACCOUNTS = [
  { code: "200", name: "Sales", active: true },
  { code: "429", name: "General Expenses", active: true },
  { code: "310", name: "Cost of Goods Sold", active: false },
] as const;
type Seed = (typeof ACCOUNTS)[number];
const labelOf = (seed: Seed) => `${seed.code} - ${seed.name}`;
const chart = (): EntityBillAccount[] =>
  ACCOUNTS.map((a, i) => ({
    id: `account-${a.code}`,
    entity_id: ID,
    account_code: a.code,
    account_name: a.name,
    account_type: "EXPENSE",
    is_default: false,
    is_active: a.active,
    sort_order: i,
  }));

/** An unsigned token carrying the claims the page reads (the API verifies the real one). */
function signIn(claims: Record<string, unknown> = {}) {
  const payload = btoa(
    JSON.stringify({
      user_id: "u1",
      entity_id: ID,
      role: "admin",
      system_role: "normal",
      ...claims,
    }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  setAuth(`h.${payload}.s`, ID, NAME);
}

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Answers by path, so a test says what the API holds rather than counting calls in order. */
function serve({
  connected = true,
  mintyOnly = false,
  accounts = () => json(chart()),
  save = () => json({}),
}: {
  connected?: boolean;
  mintyOnly?: boolean;
  accounts?: () => Response;
  save?: (id: string) => Response;
} = {}) {
  const saved: { id: string; is_active: boolean }[] = [];
  fetchMock.mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.origin !== new URL(API).origin) throw new Error(`unexpected ${url}`);
    expect(new Headers(init.headers).get("X-Entity-Id")).toBe(ID);
    const method = (init.method ?? "GET").toUpperCase();
    if (method === "GET" && url.pathname === "/api/v1/auth/xero-status")
      return json({ connected, minty_only: mintyOnly });
    if (method === "GET" && url.pathname === "/api/v1/entity-bill-accounts/") return accounts();
    const put = url.pathname.match(/^\/api\/v1\/entity-bill-accounts\/([^/]+)$/);
    if (method === "PUT" && put) {
      saved.push({ id: put[1], is_active: JSON.parse(String(init.body)).is_active });
      return save(put[1]);
    }
    throw new Error(`unexpected ${method} ${url.pathname}`);
  });
  return { saved };
}

const asked = () => fetchMock.mock.calls.map(([u]) => String(u));

function show() {
  render(
    <ToastProvider>
      <PaymentSettingsScreen company={COMPANY} />
    </ToastProvider>,
  );
}

const tick = (seed: Seed) =>
  screen.getByRole("checkbox", { name: `Include ${labelOf(seed)} in payment account dropdown` });
const saveButton = () => screen.getByRole("button", { name: /Save Changes/ });
const toastText = () => document.querySelector("[data-toast-type]")?.textContent ?? "";
const codes = () => screen.findByRole("list", { name: "Account codes" });

/** Records where a followed link would have gone, instead of jsdom navigating. */
const recorders: (() => void)[] = [];
function navigationRecorder(): string[] {
  const went: string[] = [];
  const onClick = (event: MouseEvent) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (anchor instanceof HTMLAnchorElement) {
      event.preventDefault();
      went.push(anchor.getAttribute("href") ?? "");
    }
  };
  window.addEventListener("click", onClick);
  recorders.push(() => window.removeEventListener("click", onClick));
  return went;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  signIn();
  // A failed read or save is logged on purpose; keep the run quiet.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  consoleError.mockRestore();
  while (recorders.length) recorders.pop()?.();
});

describe("the settings chrome", () => {
  it("the company, the Settings heading and the tab row, Payment Settings current", async () => {
    serve();
    show();

    expect(await screen.findByRole("heading", { level: 2, name: "Settings" })).toBeInTheDocument();
    const nav = within(screen.getByRole("navigation", { name: "Settings sections" }));
    expect(nav.getByText("Payment Settings")).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "General" })).toHaveAttribute(
      "href",
      "/entity/360812e1/olive-and-vine/settings/general",
    );
    // no pill row of its own, and no big heading of its own
    expect(screen.queryByRole("link", { name: "Payment Request Settings" })).toBeNull();
    expect(
      await screen.findByRole("heading", { level: 3, name: "Payment Account Code" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Only selected account code will appear when adding a payment in Payment."),
    ).toBeInTheDocument();
  });
});

describe("without a live Xero connection", () => {
  it("offers only a way to connect, and does not read the codes AT ALL", async () => {
    // Reading them would also start the chart re-sync, for a chart that cannot be synced.
    serve({ connected: false });
    show();

    expect(await screen.findByText(/Xero isn't connected/)).toBeInTheDocument();
    expect(asked().some((u) => u.includes("/auth/xero-status"))).toBe(true);
    expect(asked().some((u) => u.includes("/entity-bill-accounts/"))).toBe(false);
  });

  it("points at the hub's Integration tab, where Xero is connected", async () => {
    serve({ connected: false });
    show();

    // the notice's own link (the tab row has an "Integration" link too)
    const notice = await screen.findByText(/Xero isn't connected\./);
    const box = notice.closest("[role=status]") as HTMLElement;
    expect(box).toHaveTextContent(
      "Xero isn't connected. Connect it in Integration to set these up.",
    );
    expect(within(box).getByRole("link", { name: "Integration" })).toHaveAttribute(
      "href",
      INTEGRATION_HREF,
    );
  });

  it("shows no search box and no Save at all", async () => {
    serve({ connected: false });
    show();

    await screen.findByText(/Xero isn't connected/);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Save Changes/ })).toBeNull();
  });

  it("a failed status read is a failed read, never 'not connected'", async () => {
    fetchMock.mockImplementation(async () => json({ error: "boom" }, 500));
    show();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "I couldn't load your account codes. Mind refreshing the page?",
    );
    expect(screen.queryByText(/Xero isn't connected/)).toBeNull();
  });
});

describe("a company keeping its books in Minty (Xero optional)", () => {
  it("shows its own codes, though Xero is not connected", async () => {
    serve({ connected: false, mintyOnly: true });
    show();

    const list = await codes();
    expect(within(list).getAllByRole("checkbox")).toHaveLength(ACCOUNTS.length + 1); // + select all
  });
});

describe("with Xero connected", () => {
  it("shows a tick per code, ticked as the company has them", async () => {
    serve();
    show();

    const list = await codes();
    expect(within(list).getAllByRole("checkbox")).toHaveLength(ACCOUNTS.length + 1);
    for (const seed of ACCOUNTS) expect(tick(seed)).toHaveProperty("checked", seed.active);
  });

  it("asks for the inactive codes too, so an unticked one can be ticked", async () => {
    serve();
    show();

    await codes();
    expect(asked().find((u) => u.includes("/entity-bill-accounts/"))).toBe(
      `${API}/api/v1/entity-bill-accounts/?include_inactive=true`,
    );
  });

  it("says so when the codes do not load, rather than calling the list empty", async () => {
    serve({ accounts: () => json({ detail: "boom" }, 500) });
    show();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /I couldn't load your account codes/,
    );
    expect(screen.queryByText(/No account codes yet/)).toBeNull();
  });

  it("says so when the company has no codes yet", async () => {
    serve({ accounts: () => json([]) });
    show();

    expect(
      await screen.findByText("No account codes yet - I'll show them here once Xero's connected."),
    ).toBeInTheDocument();
  });

  it("filters the list as the search is typed, and says when nothing matches", async () => {
    serve();
    show();
    await codes();

    await userEvent.type(screen.getByRole("searchbox", { name: "Search account code" }), "General");
    expect(tick(ACCOUNTS[1])).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", {
        name: `Include ${labelOf(ACCOUNTS[0])} in payment account dropdown`,
      }),
    ).toBeNull();

    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "nothing like this");
    expect(screen.getByText("No codes match your search.")).toBeInTheDocument();
  });

  it("Select all ticks every code the search shows, and unticks them again", async () => {
    serve();
    show();
    await codes();

    const all = screen.getByRole("checkbox", { name: "Select all visible account codes" });
    expect(all).not.toBeChecked();
    expect((all as HTMLInputElement).indeterminate).toBe(true); // two of three
    await userEvent.click(all);
    for (const seed of ACCOUNTS) expect(tick(seed)).toBeChecked();
    await userEvent.click(all);
    for (const seed of ACCOUNTS) expect(tick(seed)).not.toBeChecked();
  });

  it("a whole row is the tap target, not only the box", async () => {
    serve();
    show();
    await codes();

    await userEvent.click(screen.getByText(labelOf(ACCOUNTS[2])));
    expect(tick(ACCOUNTS[2])).toBeChecked();
  });

  it("the card folds away and back", async () => {
    serve();
    show();
    await codes();

    const fold = screen.getByRole("button", { name: "Payment Account Code" });
    expect(fold).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(fold);
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list", { name: "Account codes" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Save Changes/ })).toBeNull();
    await userEvent.click(fold);
    expect(await codes()).toBeInTheDocument();
  });
});

describe("Save", () => {
  it("is the settings Primary, off until something changes", async () => {
    serve();
    show();
    await codes();

    expect(saveButton()).toBeDisabled();
    expect(saveButton().className).toContain(SETTINGS_PRIMARY);
    expect(screen.getByText("No changes to save yet")).toBeInTheDocument();

    await userEvent.click(tick(ACCOUNTS[2]));
    expect(saveButton()).toBeEnabled();
    expect(screen.queryByText("No changes to save yet")).toBeNull();

    await userEvent.click(tick(ACCOUNTS[2])); // put back by hand
    expect(saveButton()).toBeDisabled();
  });

  it("sends only the codes that changed, and says it went through", async () => {
    const { saved } = serve();
    show();
    await codes();

    await userEvent.click(tick(ACCOUNTS[2]));
    await userEvent.click(saveButton());

    await waitFor(() => expect(saved).toEqual([{ id: "account-310", is_active: true }]));
    await waitFor(() => expect(toastText()).toContain("Payment settings updated successfully"));
    expect(saveButton()).toBeDisabled(); // saved: nothing left to save
  });

  it("sends the ticks ON before the ticks OFF", async () => {
    // Unticking A while ticking B must never pass through a moment with nothing ticked, or the
    // server's at-least-one rule refuses the untick.
    const { saved } = serve();
    show();
    await codes();

    await userEvent.click(tick(ACCOUNTS[0])); // 200 Sales off
    await userEvent.click(tick(ACCOUNTS[2])); // 310 COGS on
    await userEvent.click(saveButton());

    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved).toEqual([
      { id: "account-310", is_active: true },
      { id: "account-200", is_active: false },
    ]);
  });

  it("greys out with nothing ticked, and says to pick one beside it", async () => {
    serve();
    show();
    await codes();

    await userEvent.click(tick(ACCOUNTS[0]));
    await userEvent.click(tick(ACCOUNTS[1]));

    expect(saveButton()).toBeDisabled();
    const hint = screen.getByText("Pick at least one account code.");
    expect(saveButton()).toHaveAttribute("aria-describedby", hint.id);
    expect(saveButton()).not.toHaveAttribute("title");
  });

  it("shows a 409 in the server's own words", async () => {
    serve({ save: () => json({ detail: "Keep at least one account code ticked." }, 409) });
    show();
    await codes();

    await userEvent.click(tick(ACCOUNTS[2]));
    await userEvent.click(saveButton());

    await waitFor(() => expect(toastText()).toContain("Keep at least one account code ticked."));
  });

  it("gives the generic retry line for any other refusal", async () => {
    serve({ save: () => json({ detail: "boom" }, 500) });
    show();
    await codes();

    await userEvent.click(tick(ACCOUNTS[2]));
    await userEvent.click(saveButton());

    await waitFor(() => expect(toastText()).toContain("Some of those changes didn't save"));
  });

  it("keeps the rows that DID save - the page measures from what the server holds", async () => {
    // 310 on goes through; 200 off is refused.
    serve({ save: (id) => (id === "account-200" ? json({ detail: "no" }, 500) : json({})) });
    show();
    await codes();

    await userEvent.click(tick(ACCOUNTS[2]));
    await userEvent.click(tick(ACCOUNTS[0]));
    await userEvent.click(saveButton());

    await waitFor(() => expect(toastText()).toContain("Some of those changes didn't save"));
    // Save is still live, because 200 is still unticked on screen and ticked on the server.
    expect(saveButton()).toBeEnabled();
    // and ticking 200 back is "nothing to save": 310 is already saved
    await userEvent.click(tick(ACCOUNTS[0]));
    expect(saveButton()).toBeDisabled();
  });
});

describe("somebody who may not change these", () => {
  it("is told to ask an Accountant or Admin, and gets no live controls", async () => {
    signIn({ role: "cashier" });
    serve();
    show();

    await codes();
    expect(
      screen.getByText(
        "You have view-only access to these settings. Ask an Accountant or Admin to make changes.",
      ),
    ).toBeInTheDocument();
    expect(tick(ACCOUNTS[0])).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Select all visible account codes" }),
    ).toBeDisabled();
    expect(saveButton()).toBeDisabled();
    expect(saveButton()).toHaveAttribute(
      "title",
      "That task is reserved for our Accountants and Admins.",
    );
  });

  it("is told plainly when they are not a member of the company at all", async () => {
    signIn({ role: "super_admin", system_role: "superadmin", is_view_only: true });
    serve();
    show();

    await codes();
    expect(
      screen.getByText("Read-only access — you are not a member of this entity."),
    ).toBeInTheDocument();
    expect(saveButton()).toHaveAttribute(
      "title",
      "Hmm, I can't let you in there. You have view-only access.",
    );
  });

  it("a system super admin's token without the claim is read as view-only", async () => {
    signIn({ role: "super_admin", system_role: "superadmin" });
    serve();
    show();

    await codes();
    expect(
      screen.getByText("Read-only access — you are not a member of this entity."),
    ).toBeInTheDocument();
  });

  it("is never shown that notice while the codes are still loading", () => {
    signIn({ role: "cashier" });
    serve();
    show();

    expect(screen.queryByText(/view-only access/)).toBeNull();
  });
});

// The guard itself is lib/__tests__/leaveGuard.test.tsx (@minty/shared); these are this page's exits.
describe("leaving with ticks not saved", () => {
  it("nothing changed: a tab just goes", async () => {
    serve();
    const went = navigationRecorder();
    show();
    await codes();

    await userEvent.click(screen.getByRole("link", { name: "Users" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(went).toEqual([expect.stringContaining("/settings/users")]);
  });

  it("asks first: Go Back stays with the tick kept, Discard changes puts the saved ticks back and goes", async () => {
    serve();
    const went = navigationRecorder();
    show();
    await codes();

    await userEvent.click(tick(ACCOUNTS[2]));
    await userEvent.click(screen.getByRole("link", { name: "Users" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName(LEAVE_TITLE);
    expect(within(dialog).getByText("You have unsaved changes.")).toBeInTheDocument();
    expect(went).toEqual([]);

    await userEvent.click(within(dialog).getByRole("button", { name: GO_BACK_UPPER }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(went).toEqual([]);
    expect(tick(ACCOUNTS[2])).toBeChecked();

    await userEvent.click(screen.getByRole("link", { name: "Users" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: DISCARD_CHANGES }),
    );
    expect(tick(ACCOUNTS[2])).not.toBeChecked(); // the saved ticks back
    expect(went).toEqual([expect.stringContaining("/settings/users")]);
  });

  it("after a save nothing is asked", async () => {
    serve();
    const went = navigationRecorder();
    show();
    await codes();

    await userEvent.click(tick(ACCOUNTS[2]));
    await userEvent.click(saveButton());
    await waitFor(() => expect(toastText()).toContain("Payment settings updated successfully"));

    await userEvent.click(screen.getByRole("link", { name: "Users" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(went).toEqual([expect.stringContaining("/settings/users")]);
  });

  it("after a refused save it still asks", async () => {
    serve({ save: () => json({ detail: "Keep at least one account code ticked." }, 409) });
    const went = navigationRecorder();
    show();
    await codes();

    await userEvent.click(tick(ACCOUNTS[2]));
    await userEvent.click(saveButton());
    await waitFor(() => expect(toastText()).toContain("Keep at least one account code ticked."));

    await userEvent.click(screen.getByRole("link", { name: "Users" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(LEAVE_TITLE);
    expect(went).toEqual([]);
  });
});
