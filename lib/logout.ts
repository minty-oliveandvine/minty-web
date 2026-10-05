/**
 * Log out - the side menu's Logout and My Profile's Log Out are the same act: forget this
 * app's token, then end the session at Minty (Flask's /logout signs the person out and lands
 * on the sign-in page - this app's /login since phase 2), so no app is left signed in behind the one that said goodbye.
 */

import { clearAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { leaveTo } from "@/lib/handoff";

export function logOut() {
  clearAuth();
  leaveTo(`${env.PETTY_CASH_URL}/logout`);
}
