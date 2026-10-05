"use client";

/**
 * `/entities/<shortid>/<name>` - "Choose Module Type" for a company with both modules on (phase 2,
 * 2026-10-05; minty-payment-request-web's `/module-selection` until then). Flask's router
 * (`/entity/<id>/modules`) decides who comes here: a company still onboarding resumes its wizard,
 * one module goes straight into it, and only two come to this page. Opened any other way (a
 * bookmark), the page follows the same rule from the database's modules: one goes straight in.
 */

import Image from "next/image";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/ui/AppHeader";
import { leaveTo } from "@/lib/handoff";
import { HUB_PATHS, companySettingsPath } from "@/lib/hubPaths";

import { fetchEntities } from "@/features/entities/api/entities";
import { ModuleChoiceButton } from "@/features/entities/components/ModuleChoiceButton";
import { MODULE_CHOICE_TITLE, moduleChoices, type ModuleChoice } from "@/features/entities/lib/moduleChoice";

export const MODULE_CHOICE_COPY = {
  title: MODULE_CHOICE_TITLE,
  none: "No module is switched on for this company yet.",
  settings: "Open its module settings",
  failed: "I couldn't load this company's modules just now.",
  retry: "Try again",
} as const;

type Load = { state: "loading" } | { state: "ready"; choices: ModuleChoice[] } | { state: "failed" };

export function ModuleChoiceScreen({ entityId, entityName }: { entityId: string; entityName: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchEntities({ signal: controller.signal })
      .then(({ entities }) => {
        const row = entities.find((e) => e.id === entityId);
        if (!row) console.error(`[module choice] ${entityId} is not in the person's list`);
        const choices = moduleChoices(entityId, row?.modules ?? []);
        if (choices.length === 1) leaveTo(choices[0].href);
        setLoad({ state: "ready", choices });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("[module choice] the company's modules could not be read", err);
        setLoad({ state: "failed" });
      });
    return () => controller.abort();
  }, [entityId, attempt]);

  return (
    // overflow-x-hidden: Minty peeks out past a door's corner (ModuleChoiceButton) - never past the screen.
    <div className="flex min-h-dvh min-w-0 flex-col overflow-x-hidden bg-white">
      {/* The way back to the list; the page names itself in its own heading. */}
      <AppHeader back={{ href: HUB_PATHS.entities, label: "Back" }} />
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-6 sm:gap-6 sm:p-8">
        <Image
          src="/minty-mark.png"
          alt=""
          width={210}
          height={210}
          priority
          unoptimized
          className="h-auto w-full max-w-[120px] sm:max-w-[150px] md:max-w-[180px] lg:max-w-[210px]"
        />
        <div className="flex max-w-full items-center gap-3 rounded-full border border-gray-100 bg-white px-4 py-2 shadow-sm">
          <span className="material-symbols-outlined text-[20px] text-[#00838F]" aria-hidden>
            corporate_fare
          </span>
          <span className="min-w-0 truncate text-sm font-semibold text-[#474747]">{entityName}</span>
        </div>
        <h1 className="text-center text-lg font-bold text-black sm:text-xl md:text-2xl">{MODULE_CHOICE_COPY.title}</h1>

        {load.state === "loading" ? (
          <p className="text-sm text-muted" role="status">
            Loading…
          </p>
        ) : null}
        {load.state === "failed" ? (
          <div className="text-center" role="alert">
            <p className="text-sm text-danger">{MODULE_CHOICE_COPY.failed}</p>
            <button type="button" className="mt-2 min-h-11 text-sm underline" onClick={() => setAttempt((n) => n + 1)}>
              {MODULE_CHOICE_COPY.retry}
            </button>
          </div>
        ) : null}
        {load.state === "ready" && load.choices.length === 0 ? (
          <p className="text-center text-sm text-ink-soft">
            {MODULE_CHOICE_COPY.none}{" "}
            <a className="font-semibold text-teal-strong underline" href={companySettingsPath(entityId, entityName)}>
              {MODULE_CHOICE_COPY.settings}
            </a>
          </p>
        ) : null}
        {load.state === "ready" && load.choices.length > 1 ? (
          <nav
            aria-label="Modules"
            className="mx-auto flex w-full max-w-[260px] flex-col items-center gap-4 sm:max-w-[400px] md:max-w-[820px] md:flex-row md:justify-center md:gap-6"
          >
            {load.choices.map((c) => (
              <ModuleChoiceButton key={c.code} code={c.code} label={c.label} href={c.href} />
            ))}
          </nav>
        ) : null}
      </main>
    </div>
  );
}
