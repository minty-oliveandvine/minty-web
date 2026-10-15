/**
 * Stripe.js, loaded once per publishable key - for every form here that is Stripe's own: the
 * card fields (`CardCaptureForm`) and 08-C's address (`BillingDetailsForm`).
 *
 * At module scope because Stripe.js injects a script tag, and rebuilding it mid-flow tears
 * down the mounted iframe. The key comes from the server (it knows which Stripe account is
 * configured), so this is a small cache rather than a constant.
 */

// `/pure`: the main entry injects js.stripe.com on IMPORT, and this module sits behind the
// subscription barrel the root layout imports - so every page, /landing with its token in
// the address bar included, ran Stripe's script. `/pure` loads it only when a form calls this.
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";

/**
 * The face the appearances here name, handed to the iframe that has to render it.
 *
 * `appearance.variables.fontFamily: "Inter, ..."` on its own is a request for a font the iframe
 * does not have: the fields are a cross-origin document, so ours is the one stylesheet that
 * cannot reach them, and the name silently resolved to the system face. `fonts` is the only way
 * in. It has to be a URL, not our own copy - minty-web self-hosts Inter through next/font and
 * those files are not reachable from inside the iframe - so this is Google's, the same copy
 * minty-onboarding-web loads for its whole app.
 *
 * Only the weights the fields use (the label is 600). Module scope, like the appearances: a new
 * object identity on every render is a changed prop to Stripe.
 */
export const STRIPE_FONTS = [
  { cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" },
];

const stripeByKey = new Map<string, Promise<Stripe | null>>();

export function stripeFor(key: string): Promise<Stripe | null> {
  let promise = stripeByKey.get(key);
  if (!promise) {
    // Resolves to null rather than rejecting when the script cannot be fetched at all - an ad
    // blocker, a privacy extension, a proxy. Left to reject it becomes an unhandled rejection
    // and the form simply sits there with nothing said.
    promise = loadStripe(key).catch(() => null);
    stripeByKey.set(key, promise);
  }
  return promise;
}
