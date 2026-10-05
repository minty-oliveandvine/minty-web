// A company's module choice (phase 2): the database's modules decide the doors, each door enters
// its module through Minty's /enter, one module goes straight in, none says so, and a failed read
// says so and can be tried again.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";
import { _setViewerLoaderForTests } from "@/lib/viewer";

import { LIST } from "@/features/entities/__fixtures__/entities";
import type { EntityRow } from "@/features/entities/api/entities";
import { moduleChoices } from "@/features/entities/lib/moduleChoice";
import { MODULE_CHOICE_COPY, ModuleChoiceScreen } from "@/features/entities/routes/ModuleChoiceScreen";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const ID = "360812e1-9f94-46a3-aa31-347e21afde8e";
const fetchMock = vi.fn<typeof fetch>();
const navigate = vi.fn<(url: string) => void>();

const row = (modules: string[]): EntityRow => ({ ...LIST.entities[0], id: ID, name: "Olive & Vine", modules });
const serve = (entities: EntityRow[], status = 200) =>
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ entities, notices: [] }), { status, headers: { "Content-Type": "application/json" } }),
  );
const enter = (path: string) =>
  `${env.PETTY_CASH_URL}/entity/${ID}/enter?token=${encodeURIComponent(TOKEN)}&next=${encodeURIComponent(path)}`;

describe("moduleChoices", () => {
  beforeEach(() => setAuth(TOKEN, ID, "Olive & Vine"));

  it("offers the modules switched on, each entered through Minty", () => {
    expect(moduleChoices(ID, ["PAYMENT_REQUEST", "PETTY_CASH"])).toEqual([
      { code: "PETTY_CASH", label: "Petty Cash", href: enter(`/entity/${ID}/petty-cash`) },
      { code: "PAYMENT_REQUEST", label: "Payment Request", href: enter(`/entity/${ID}/payment-request`) },
    ]);
    expect(moduleChoices(ID, [])).toEqual([]);
  });
});

describe("ModuleChoiceScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    _resetHandoffForTests(navigate);
    _setViewerLoaderForTests(async () => null);
    setAuth(TOKEN, ID, "Olive & Vine");
    fetchMock.mockReset();
    navigate.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetHandoffForTests();
    _setViewerLoaderForTests(null);
  });

  it("draws a door per module, from the database's modules", async () => {
    serve([row(["PETTY_CASH", "PAYMENT_REQUEST"])]);
    render(<ModuleChoiceScreen entityId={ID} entityName="Olive & Vine" />);

    expect(await screen.findByRole("link", { name: "Petty Cash" })).toHaveAttribute("href", enter(`/entity/${ID}/petty-cash`));
    expect(screen.getByRole("link", { name: "Payment Request" })).toHaveAttribute(
      "href",
      enter(`/entity/${ID}/payment-request`),
    );
    expect(screen.getByRole("heading", { level: 1, name: MODULE_CHOICE_COPY.title })).toBeInTheDocument();
    expect(screen.getByText("Olive & Vine")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("one module: straight into it", async () => {
    serve([row(["PAYMENT_REQUEST"])]);
    render(<ModuleChoiceScreen entityId={ID} entityName="Olive & Vine" />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(enter(`/entity/${ID}/payment-request`)));
  });

  it("no module: says so, with the way to its module settings", async () => {
    serve([row([])]);
    render(<ModuleChoiceScreen entityId={ID} entityName="Olive & Vine" />);

    expect(await screen.findByText(MODULE_CHOICE_COPY.none)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: MODULE_CHOICE_COPY.settings })).toHaveAttribute(
      "href",
      "/entities/360812e1/olive-and-vine/settings/modules",
    );
  });

  it("a failed read says so, logs it, and can be tried again", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    serve([], 500);
    serve([row(["PETTY_CASH", "PAYMENT_REQUEST"])]);
    render(<ModuleChoiceScreen entityId={ID} entityName="Olive & Vine" />);

    expect(await screen.findByText(MODULE_CHOICE_COPY.failed)).toBeInTheDocument();
    expect(error).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: MODULE_CHOICE_COPY.retry }));
    expect(await screen.findByRole("link", { name: "Petty Cash" })).toBeInTheDocument();
    error.mockRestore();
  });
});
