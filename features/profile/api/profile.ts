/**
 * My Profile's read and its one write: Flask's `GET` / `PATCH /api/me/profile` (Minty's
 * `blueprints/user_management/routes/me_api.py`, rules in `services/profile.py`) - identity is
 * Flask's until minty-accounts-api takes this contract in Part 3.
 *
 * `entityId` names the company the profile was opened from (`?entity=`): the answer then says
 * the company, the person's role there and its modules. Flask refuses a company the person may
 * not see (403) - the cookie's company is the only one ever sent.
 *
 * The profile is drawn by `@minty/shared/profile` (v0.6, the owner 2026-10-20: one
 * implementation for every app) and its two calls are `createProfileApi` from
 * `@minty/shared/portal` (owner 2026-10-21: one shared module), over this app's Flask client
 * (`flaskJson`, lib/apiClient.ts); `profileApi` is this app's part of it.
 */

import { createProfileApi } from "@minty/shared/portal";

import { flaskJson } from "@/lib/apiClient";

export type { Profile, ProfileChanges, ProfileCompany, ProfileUser } from "@minty/shared/profile";

/** The two calls, as the packaged panel takes them. Module-level: a new object reads again. */
export const profileApi = createProfileApi(flaskJson);
