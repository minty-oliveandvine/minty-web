/**
 * Where the feature is mounted. ONE constant: the shell mounts the entity list at /entities
 * (`app/entities/page.tsx`, `lib/hubPaths.ts`), and this is the only place inside the feature
 * that spells it - an app mounting it elsewhere changes this line (README.md).
 */
export const ENTITIES_BASE_PATH = "/entities";
