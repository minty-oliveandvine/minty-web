"use client";

/**
 * `/entities` - the select-company list. The query string carries `flash` (Flask's signed
 * hand-over of what it flashed on the way here) and the dev-only `fixture` switch.
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { EntityListScreen } from "@/features/entities/routes/EntityListScreen";

function Content() {
  const q = useSearchParams();
  return <EntityListScreen flash={q.get("flash")} fixture={q.get("fixture")} />;
}

export function EntityList() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
