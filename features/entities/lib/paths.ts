/**
 * Where the feature is mounted. ONE constant: the shell mounts the entity list at /entities
 * (`app/entities/page.tsx`, `lib/hubPaths.ts`), and this is the only place inside the feature
 * that spells it - an app mounting it elsewhere changes this line (README.md).
 *
 * The LIST is plural. One company's pages are `/entity/<shortid>/<name>/…` (singular -
 * `HUB_PATHS.company`, built by `companyPath`), which the shell owns, not this constant.
 */
export const ENTITIES_BASE_PATH = "/entities";
