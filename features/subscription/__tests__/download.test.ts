// Handing the browser a file (@minty/shared/download since the shared-code refactor, 2026-10-21;
// it was features/subscription/lib/download.ts): an object URL on a temporary hidden
// <a download>, clicked while it is in the document, removed at once, and the URL revoked only
// after the click has been handled.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveBlob, saveTextFile } from "@minty/shared/download";

type Click = { href: string; download: string; inDocument: boolean; hidden: boolean };

describe("saveBlob(blob, filename)", () => {
  const created: Blob[] = [];
  const revoked: string[] = [];
  const clicks: Click[] = [];
  const anchors: HTMLAnchorElement[] = [];

  beforeEach(() => {
    created.length = 0;
    revoked.length = 0;
    clicks.length = 0;
    anchors.length = 0;
    vi.useFakeTimers();
    // jsdom has no object URLs; these stand in for the browser's.
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: (b: Blob) => {
        created.push(b);
        return `blob:test/${created.length}`;
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: (u: string) => revoked.push(u),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      anchors.push(this);
      clicks.push({
        href: this.getAttribute("href") ?? "",
        download: this.download,
        inDocument: document.body.contains(this),
        hidden: this.style.display === "none",
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes the BLOB first, then the filename, and clicks a hidden <a download> holding the blob's URL", () => {
    // owner 2026-10-21: one shared module (@minty/shared/download) - the order was (filename, blob)
    // and the link was not hidden
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    saveBlob(blob, "INV-0042.pdf");
    expect(created).toEqual([blob]);
    expect(clicks).toEqual([
      { href: "blob:test/1", download: "INV-0042.pdf", inDocument: true, hidden: true },
    ]);
  });

  it("still removes the link and revokes the URL when the click throws", () => {
    // owner 2026-10-21: one shared module (@minty/shared/download) - a throwing click left both behind
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(function (
      this: HTMLAnchorElement,
    ) {
      anchors.push(this);
      throw new Error("blocked");
    });
    expect(() => saveBlob(new Blob(["x"]), "a.pdf")).toThrow("blocked");
    expect(document.body.contains(anchors[0])).toBe(false);
    vi.runAllTimers();
    expect(revoked).toEqual(["blob:test/1"]);
  });

  it("removes the link at once, but revokes the URL only on the next tick", () => {
    saveBlob(new Blob(["x"]), "a.pdf");
    expect(anchors).toHaveLength(1);
    expect(document.body.contains(anchors[0])).toBe(false);
    expect(revoked).toEqual([]);
    vi.runAllTimers();
    expect(revoked).toEqual(["blob:test/1"]);
  });

  it("keeps the filename exactly as given - no sanitising", () => {
    saveBlob(new Blob(["x"]), "Olive & Vine / Q3 breakdown.csv");
    expect(clicks[0].download).toBe("Olive & Vine / Q3 breakdown.csv");
  });

  it("saveTextFile(text, filename) prefixes a UTF-8 byte-order mark and types the file as CSV by default", async () => {
    saveTextFile("a,b\n", "b.csv");
    expect(created[0].type).toBe("text/csv;charset=utf-8");
    const bytes = new Uint8Array(await created[0].arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe("a,b\n");
    expect(clicks[0].download).toBe("b.csv");

    saveTextFile("hi", "c.txt", "text/plain");
    expect(created[1].type).toBe("text/plain");
  });
});
