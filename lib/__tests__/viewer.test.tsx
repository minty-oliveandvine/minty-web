// Who is looking (lib/viewer.ts): read once per token, never twice, harmless but not silent when it
// fails, and updated at once when My Profile saves a new name.

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";
import { _setViewerLoaderForTests, primeViewer, useViewer, type Viewer } from "@/lib/viewer";

function Probe({ known }: { known?: Viewer | null }) {
  const viewer = useViewer(known);
  return <p data-testid="viewer">{viewer ? `${viewer.initials}|${viewer.name}` : "nobody"}</p>;
}

const shown = () => screen.getByTestId("viewer").textContent;

describe("useViewer", () => {
  afterEach(() => _setViewerLoaderForTests(null));

  it("reads once per token however many places ask", async () => {
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    const loader = vi.fn(() => Promise.resolve({ name: "Olive Vine", initials: "OV" }));
    _setViewerLoaderForTests(loader);

    render(
      <>
        <Probe />
        <Probe />
      </>,
    );
    await waitFor(() => expect(screen.getAllByText("OV|Olive Vine")).toHaveLength(2));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("a failed read leaves nobody shown, does not throw, and says why on the console", async () => {
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    const failure = new Error("Flask is down");
    const loader = vi.fn(() => Promise.reject(failure));
    _setViewerLoaderForTests(loader);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Probe />);
    await waitFor(() =>
      expect(logged).toHaveBeenCalledWith("[viewer] the name and initials did not load", failure),
    );
    expect(shown()).toBe("nobody");
    logged.mockRestore();
  });

  it("a viewer the page already knows is used as it stands, with no read", () => {
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    const loader = vi.fn(() => Promise.resolve(null));
    _setViewerLoaderForTests(loader);

    render(<Probe known={{ name: "Pay Er", initials: "PE" }} />);
    expect(shown()).toBe("PE|Pay Er");
    expect(loader).not.toHaveBeenCalled();
  });

  it("no token, no read", () => {
    const loader = vi.fn(() => Promise.resolve(null));
    _setViewerLoaderForTests(loader);
    render(<Probe />);
    expect(shown()).toBe("nobody");
    expect(loader).not.toHaveBeenCalled();
  });

  it("primeViewer shows a new name everywhere at once", async () => {
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    _setViewerLoaderForTests(() => Promise.resolve({ name: "Olive Vine", initials: "OV" }));
    render(<Probe />);
    await waitFor(() => expect(shown()).toBe("OV|Olive Vine"));

    act(() => primeViewer({ name: "Olivia Vine", initials: "OV" }));
    expect(shown()).toBe("OV|Olivia Vine");
  });
});
