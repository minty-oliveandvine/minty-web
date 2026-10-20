/**
 * My Profile's reads and its one write: Flask's `GET` / `PATCH /api/me/profile` (Minty's
 * `blueprints/user_management/routes/me_api.py`, rules in `services/profile.py`) - identity is
 * Flask's until minty-accounts-api takes this contract in Part 3.
 *
 * `entityId` names the company the profile was opened from (`?entity=`): the answer then says
 * the company, the person's role there and its modules. Flask refuses a company the person may
 * not see (403) - the cookie's company is the only one ever sent.
 *
 * The profile itself is drawn by `@minty/shared/profile` (v0.6, the owner 2026-10-20: one
 * implementation for every app); `profileApi` is this app's part of it.
 */

import type { Profile, ProfileApi, ProfileChanges } from "@minty/shared/profile";

import { mintyFetch } from "@/lib/apiClient";

export type { Profile, ProfileChanges, ProfileCompany, ProfileUser } from "@minty/shared/profile";

const query = (entityId: string | null | undefined) => ({ entity: entityId || undefined });

export function fetchProfile({
  entityId,
  signal,
}: { entityId?: string | null; signal?: AbortSignal } = {}): Promise<Profile> {
  return mintyFetch<Profile>("/api/me/profile", { query: query(entityId), signal });
}

/** Saves the person's own name and email; answers with the fresh profile. A refusal rejects
 *  with Flask's sentence (422), to be shown as it stands. */
export function saveProfile(changes: ProfileChanges, entityId?: string | null): Promise<Profile> {
  return mintyFetch<Profile>("/api/me/profile", {
    method: "PATCH",
    json: changes,
    query: query(entityId),
  });
}

/** The two calls, as the packaged panel takes them. Module-level: a new object reads again. */
export const profileApi: ProfileApi = {
  load: (entityId, signal) => fetchProfile({ entityId, signal }),
  save: (changes, entityId) => saveProfile(changes, entityId),
};
