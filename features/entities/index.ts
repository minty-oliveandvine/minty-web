/**
 * THE public surface of the entity-list feature. `app/entities/**` re-exports from here and
 * nothing else may import anything deeper (eslint.config.mjs, boundaries/entry-point).
 *
 * Route components only, plus where the feature is mounted - the same rule as
 * `features/subscription` (README.md): the shell renders the page and knows nothing about how
 * it works, which is what makes the folder liftable.
 */

export { EntityList } from "@/features/entities/routes/EntityList";
export { ModuleChoice } from "@/features/entities/routes/ModuleChoice";
export { ENTITIES_BASE_PATH } from "@/features/entities/lib/paths";
