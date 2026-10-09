// Every mandatory field keeps its red asterisk.
//
// This repo had eighteen mandatory fields and not one marker, which is how it drifted: there
// was nothing to notice the absence. This reads the source rather than rendering, because
// several of these forms sit behind API mocks and a branch no test renders is exactly where a
// marker goes missing. Same idea as minty-payment-request-web's no_new_tab_file_links lock.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** file -> the labels in it that must be followed by the mark. */
const MARKED: Record<string, string[]> = {
  "features/company-settings/components/InviteDialog.tsx": [
    "Email",
    "Role",
    "First name",
    "Last name",
  ],
  "features/company-settings/components/DetailsForm.tsx": ["Company name", "Country", "Currency"],
  "features/auth/routes/LoginScreen.tsx": ["First name", "Last name", "Email"],
  // one shared renderer, so its {label} covers both Billing Email and Billing company
  "features/subscription/components/AccountSheet.tsx": ["{label}"],
  "features/subscription/components/CardCaptureForm.tsx": ["Payment method"],
};

/** Announced on the control instead: these fields have no visible label to hang a mark on. */
const ANNOUNCED_ONLY: Record<string, string> = {
  "features/profile/components/DetailsCard.tsx": 'aria-label="Email"',
  "features/auth/components/CodeInput.tsx": 'aria-label="Your 6-digit code"',
};

const escapeForRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("mandatory fields carry the mark", () => {
  for (const [file, labels] of Object.entries(MARKED)) {
    describe(file, () => {
      it("imports the shared mark rather than hand-rolling an asterisk", () => {
        expect(read(file)).toContain('from "@/components/ui/RequiredMark"');
      });

      for (const label of labels) {
        it(`marks ${label}`, () => {
          const pattern = new RegExp(`${escapeForRegex(label)}\\s*<RequiredMark\\s*/>`);
          expect(read(file)).toMatch(pattern);
        });
      }
    });
  }

  for (const [file, needle] of Object.entries(ANNOUNCED_ONLY)) {
    it(`${file} announces requiredness on the control`, () => {
      const text = read(file);
      expect(text).toContain(needle);
      expect(text).toContain('aria-required="true"');
    });
  }
});

describe("one convention, not several", () => {
  it("has no hand-rolled red asterisks beside the shared mark", () => {
    // Anything writing its own asterisk is a second convention waiting to drift apart.
    for (const file of [...Object.keys(MARKED), ...Object.keys(ANNOUNCED_ONLY)]) {
      expect(read(file), file).not.toMatch(/text-red-500">\s*\*/);
    }
  });
});
