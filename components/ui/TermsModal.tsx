"use client";

/**
 * The Terms & Conditions panel over a page of this app - Flask's panel
 * (Minty `templates/legal/_terms_panel.html` + `_terms_script.html`) ported as it looks, in the
 * modal it takes over the Select Company list. There is no Terms frame in Figma.
 *
 * A GATE, not a dialog: no close button, no click-outside, no Escape. The only ways out are
 * Accept & Continue (Flask records it) and Cancel (log out) - someone who will not agree has
 * nowhere else to go. Focus stays inside it; the page behind is inert (TermsGate).
 *
 * The tick box stays locked until the document has been scrolled to its end (4 px of
 * tolerance; a document that does not scroll unlocks at once; re-checked when the box
 * resizes). An INTERFACE control, as Flask's is: the server cannot tell whether anyone
 * scrolled and does not try - the consent record is the binding part.
 */

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { ApiError } from "@/lib/apiClient";
import { env } from "@/lib/env";
import { logOut } from "@/lib/logout";
import { acceptTerms, type OwedTerms } from "@/lib/terms";

import styles from "./TermsModal.module.css";

export const TERMS_COPY = {
  title: "Terms & Conditions",
  lead: "Please review and accept our Terms & Conditions and Privacy Policy to finish setting up your account.",
  updateLead:
    "We have made a meaningful change to our Terms, so we are asking you to review and accept them again.",
  scrollHint: "Please scroll to the end of the Terms & Conditions to continue.",
  accept: "Accept & Continue",
  cancel: "Cancel",
  unreachable: "Could not reach the server. Please try again.",
} as const;

/** The end of the document, give or take sub-pixel layout and zoom (Flask's 4 px). */
const TOLERANCE = 4;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type TermsModalProps = {
  terms: OwedTerms;
  /** Recorded: the gate lifts and the person stays on the page they are on. */
  onAccepted: () => void;
  /** 409 - the Terms changed while this sat open: read them again and ask again. */
  onChanged: () => void;
};

export function TermsModal({ terms, onAccepted, onChanged }: TermsModalProps) {
  const { document: doc, is_update, previous_version, links } = terms;
  const titleId = useId();
  const hintId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [read, setRead] = useState(false);
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Held in place: the page cannot scroll behind it, focus starts on it and Tab cycles inside it.
  useEffect(() => {
    const node = dialog.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !node) return;
      const inside = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (inside.length === 0) return;
      const first = inside[0];
      const last = inside[inside.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === node || !node.contains(at))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !node.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Read to the end. The first check waits a tick - for layout, and so no state is set while
  // the effect itself runs.
  useEffect(() => {
    const box = scroller.current;
    if (!box || read) return;
    const atEnd = () => box.scrollHeight - box.scrollTop - box.clientHeight <= TOLERANCE;
    // A document shorter than its own box has nothing to scroll: without this branch those
    // readers could never unlock it - the classic failure of this pattern.
    const check = () => {
      if (box.scrollHeight <= box.clientHeight + TOLERANCE || atEnd()) setRead(true);
    };
    const onScroll = () => {
      if (atEnd()) setRead(true);
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", check);
    // Web fonts and a narrower window change the document's height after first paint.
    const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(check);
    resized?.observe(box);
    const first = window.setTimeout(check, 0);
    return () => {
      box.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", check);
      resized?.disconnect();
      window.clearTimeout(first);
    };
  }, [read]);

  const accept = async () => {
    if (!ticked || busy) return;
    setBusy(true);
    setError("");
    try {
      await acceptTerms(doc.version);
      onAccepted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return; // off to Flask for a fresh token
      setBusy(false);
      if (err instanceof ApiError && err.status === 409) {
        // Changed while this sat open: agree to what is live now, not to replaced wording.
        setTicked(false);
        onChanged();
        return;
      }
      setError(err instanceof ApiError ? err.message : TERMS_COPY.unreachable);
    }
  };

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialog}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles.grid}>
          <div className={styles.main}>
            <h1 id={titleId} className={styles.title}>
              {TERMS_COPY.title}
            </h1>

            {is_update ? (
              <>
                <p className={styles.lead}>{TERMS_COPY.updateLead}</p>
                <div className={styles.note}>
                  You previously agreed to version <strong>{previous_version}</strong>. You can read
                  the version you agreed to before{" "}
                  {links.previous ? (
                    <a
                      href={`${env.PETTY_CASH_URL}${links.previous}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      here
                    </a>
                  ) : (
                    "here"
                  )}
                  .
                </div>
              </>
            ) : (
              <p className={styles.lead}>{TERMS_COPY.lead}</p>
            )}

            {doc.show_draft_notice ? (
              <div className={styles.draft}>
                <strong>Draft.</strong> This wording is not final, so this screen is for testing
                only.
              </div>
            ) : null}

            <div className={styles.card}>
              {/* Only when the version has a date - better no line than an invented date. */}
              {doc.effective_date ? (
                <p className={styles.updated}>Last updated: {doc.effective_date}</p>
              ) : null}
              <div
                ref={scroller}
                className={styles.doc}
                role="region"
                aria-label="The Terms & Conditions"
                tabIndex={0}
                // Flask's legal.render escapes the source before applying any markup.
                dangerouslySetInnerHTML={{ __html: doc.html }}
              />
            </div>

            <label className={styles.check}>
              {/* Starts unticked, always: a pre-ticked box is not agreement. */}
              <input
                type="checkbox"
                checked={ticked}
                disabled={!read}
                onChange={(e) => setTicked(e.target.checked)}
                aria-describedby={read ? undefined : hintId}
              />
              <span>
                I have read and agree to the{" "}
                <a
                  href={`${env.PETTY_CASH_URL}${links.terms}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms &amp; Conditions
                </a>{" "}
                and{" "}
                <a
                  href={`${env.PETTY_CASH_URL}${links.privacy}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>
            {/* The lock explains itself to anyone who can see it; a screen reader meets a
                disabled box, so it is told why. */}
            {read ? null : (
              <p id={hintId} className={styles.srOnly}>
                {TERMS_COPY.scrollHint}
              </p>
            )}
          </div>

          <aside className={styles.side}>
            {/* Decorative: a screen reader announcing it would put noise between the person and
                the agreement. 400x467 is the RENDERED 6:7 box, reserved before it loads. */}
            <Image
              className={styles.illus}
              src="/legal/minty_important_update.png"
              alt=""
              width={400}
              height={467}
              unoptimized
            />
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={logOut}>
                {TERMS_COPY.cancel}
              </button>
              <button
                type="button"
                className={styles.accept}
                disabled={!ticked || busy}
                onClick={() => void accept()}
              >
                {TERMS_COPY.accept}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
            <div className={styles.error} role="alert">
              {error}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
