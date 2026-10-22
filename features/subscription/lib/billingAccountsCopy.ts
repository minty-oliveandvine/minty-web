// Two sentences the billing-account sheet shows, kept free of any @minty/shared import so the
// Playwright spec 06_billing can read them: Playwright will not load the package's .ts source.

export const ADDRESS_UNAVAILABLE =
  "The address form couldn't load, so the address can't be changed right now. The company name and email still can.";

/** A field over the API's 255-character limit. */
export const TOO_LONG = "Keep that under 255 characters.";
