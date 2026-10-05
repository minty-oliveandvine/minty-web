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
