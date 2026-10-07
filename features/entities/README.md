# features/entities — the bounded folder

The entity list: "Select Company" at `/entities`, the hub's first page. It replaced Flask's
Jinja `/entity` on 2026-09-29 (Minty's `/entity` sends the browser here - always, since phase 2). Its contents
are that page's — Figma 02's background is a screenshot of it — in Flask's column, under the
payments app's header bar across the whole screen (`docs/features/entities.md`, the layout).
Built the same way as `features/subscription`, so it can be lifted into another app on its own.

## Layout

```
index.ts        the ONLY public surface: EntityList and ModuleChoice (the route components) + ENTITIES_BASE_PATH
api/            entities.ts - Flask's GET /api/me/entities, typed (mintyFetch)
hooks/          useEntityList - the read, search, the flashed notices, the unscoped-token rule
lib/            entityRows (pure: search, the clock's words, the trial label, where a card leads), paths,
                moduleChoice (a company's doors: the database's modules, each entered through Minty's /enter)
components/     EntityCard (one company's row), EntityListParts (header, doors, the search box that stays, +, the states),
                ModuleChoiceButton (one module's door - minty-payment-request-web's ModuleButton, moved here)
routes/         EntityList (Suspense + the query string) -> EntityListScreen (the page);
                ModuleChoice (the company from the address) -> ModuleChoiceScreen ("Choose Module Type", phase 2)
__fixtures__/   the 02-A rows + an empty list - shared by Vitest, Playwright and ?fixture=LIST|EMPTY
__tests__/      Vitest: the rules, the screen, the re-export guard
e2e/            Playwright: 07_entity_list.spec.ts and 11_module_choice.spec.ts, over a stubbed Flask
```

## The rules (enforced by `npm run lint` and `npm test`)

1. This folder imports only itself, `@/lib/**`, `@/components/ui/**` and packages — never
   `@/app/**`, never another feature.
2. Nothing outside imports `@/features/entities/*` except `app/entities/**`, and it imports the
   index only.
3. `app/entities/page.tsx` and `app/entity/[ref]/[slug]/page.tsx` are one-line re-exports
   (`__tests__/reexports.test.ts`; the company's settings tabs under `[slug]/settings/` belong to
   the features that draw them).
4. Links inside the feature to its own mount point use `lib/paths.ts`; to other features,
   `@/lib/hubPaths` (the shell's map).

## Extraction recipe

1. `git mv features/entities <new-repo>/features/entities` and `git mv app/entities
   <new-repo>/app/entities`; delete its line from this app's `lib/hubPaths.ts`.
2. In the new repo, point `@/lib/*` and `@/components/ui/*` at `@minty/shared` (the side menu,
   the initials badge, `mintyFetch`, `mintyEnterCompanyUrl`) or copy them across.
3. Copy `public/entities/*` (the doors, the empty desk, the till, the free-trial tag).
4. Move `e2e/*.spec.ts` under the new repo's Playwright config (`e2e/helpers.ts` travels too).
5. `npm run lint` in both repos: the boundary rules must still hold on both sides.
