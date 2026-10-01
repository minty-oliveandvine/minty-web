import { redirect } from "next/navigation";

import { HUB_HOME } from "@/lib/hubPaths";

/**
 * `/` is the hub's first page: the entity list, where a person picks a company (it replaced
 * Flask's /entity on 2026-09-29).
 */
export default function Home() {
  redirect(HUB_HOME);
}
