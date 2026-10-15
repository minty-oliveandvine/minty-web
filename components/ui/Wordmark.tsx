/**
 * The "Minty" name, as type.
 *
 * The rule (2026-10-12): the Minty name is always Plus Jakarta Sans - but the BRAND LOCKUP only,
 * the name standing as the mark in a header, topbar, sidebar, auth shell or footer. The word
 * inside a sentence, a headline, a plan name or an FAQ answer stays in the body face (Inter), so
 * copy is never broken up to re-typeset one word.
 *
 * Every lockup that draws the name as text goes through here, so the treatment lives in one
 * place: the face (--font-brand, app/globals.css), weight 700 and the -0.005em tracking. Those
 * three are minty-onboarding-web's `.topbar .brand` value for value - change the two together.
 * A lockup drawn as an image instead (SideMenu's minty-logo.svg, AppHeader's showLogo) needs
 * nothing from here.
 *
 * Size and colour stay with the caller, since they differ per bar.
 */

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-brand font-bold tracking-[-0.005em] ${className}`}>Minty</span>;
}
