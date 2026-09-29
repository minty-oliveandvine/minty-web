"use client";

/**
 * My Profile: read the person (and the company it was opened from, when it was), and edit the
 * details card - first name, last name, email - in place. The screen calls this and renders
 * what it returns - the `/profile` page and the sidebar's My Profile alike.
 *
 * - The company is the cookie's: opened from inside one, the profile names it, the person's
 *   role there and its plan; opened from the entity list, there is none to name.
 * - A save sends only what changed, answers with the fresh profile, and tells the header and
 *   the side menu the new name at once (`primeViewer`) - billing-frontend's badge kept the old
 *   initials until the next token. A refusal is Flask's sentence, shown in the card; the card
 *   stays open so nothing typed is lost.
 * - `fixture`: dev-only, `?fixture=SCOPED|SUPERMINTY|UNSCOPED` (`__fixtures__/profile.ts`).
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/apiClient";
import { getAuth } from "@/lib/auth";
import { primeViewer } from "@/lib/viewer";

import {
  fetchProfile,
  saveProfile,
  type Profile,
  type ProfileChanges,
} from "@/features/profile/api/profile";
import { changesFrom, LOAD_FAILED, SAVE_FAILED, SAVED } from "@/features/profile/lib/profileView";

export type UseProfileArgs = { fixture?: string | null };

export type Draft = Required<ProfileChanges>;

type Loaded = { attempt: number; profile: Profile | null; error: string | null };

// Primitives only: a fresh object per read would make useSyncExternalStore loop.
const noSubscribe = () => () => {};
const readEntityId = () => getAuth()?.entityId ?? "";
const serverEmpty = () => "";

async function load(
  entityId: string,
  fixture: string | null,
  signal: AbortSignal,
): Promise<Profile> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/profile/__fixtures__/profile");
    if (f.isProfileFixture(fixture)) return f.FIXTURES[fixture];
  }
  return fetchProfile({ entityId, signal });
}

const draftOf = (p: Profile): Draft => ({
  first_name: p.user.first_name,
  last_name: p.user.last_name,
  email: p.user.email,
});

/** Everything My Profile draws, as `useProfile` returns it - what `ProfileBody` is handed. */
export type ProfileModel = ReturnType<typeof useProfile>;

export function useProfile({ fixture = null }: UseProfileArgs = {}) {
  const { showToast } = useToast();
  const entityId = useSyncExternalStore(noSubscribe, readEntityId, serverEmpty);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    load(entityId, fixture, controller.signal)
      .then((profile) => {
        if (!controller.signal.aborted) setLoaded({ attempt, profile, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // A 401 has already sent the browser for a fresh token; there is nothing to show.
        if (err instanceof ApiError && err.status === 401) return;
        setLoaded({
          attempt,
          profile: null,
          error: err instanceof ApiError ? err.message : LOAD_FAILED,
        });
      });
    return () => controller.abort();
  }, [attempt, entityId, fixture]);

  const status =
    loaded === null || loaded.attempt !== attempt ? "loading" : loaded.error ? "error" : "ready";
  const profile = status === "ready" ? (loaded?.profile ?? null) : null;

  const startEditing = useCallback(() => {
    if (!profile) return;
    setDraft(draftOf(profile));
    setSaveError(null);
  }, [profile]);

  const stopEditing = useCallback(() => {
    setDraft(null);
    setSaveError(null);
  }, []);

  const change = useCallback((field: keyof Draft, value: string) => {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
  }, []);

  const save = useCallback(async () => {
    if (!profile || !draft || saving) return;
    const { changes, error } = changesFrom(draft, draftOf(profile));
    if (error) {
      setSaveError(error);
      return;
    }
    if (Object.keys(changes).length === 0) {
      stopEditing();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const fresh = await saveProfile(changes, entityId);
      setLoaded({ attempt, profile: fresh, error: null });
      primeViewer({ name: fresh.user.name, initials: fresh.user.initials });
      setDraft(null);
      showToast(SAVED, "success");
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        setSaveError(err instanceof ApiError ? err.message : SAVE_FAILED);
      }
    } finally {
      setSaving(false);
    }
  }, [profile, draft, saving, entityId, attempt, stopEditing, showToast]);

  return {
    status,
    error: status === "error" ? (loaded?.error ?? LOAD_FAILED) : null,
    profile,
    entityId,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
    draft,
    editing: draft !== null,
    saving,
    saveError,
    startEditing,
    stopEditing,
    change,
    save,
  };
}
