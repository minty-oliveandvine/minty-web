# Features — what minty-web does and where each part lives

`minty-web` is the Next.js hub of the Minty system, born in Part 2 of the modernisation plan
with one feature: subscriptions — the payer portal and a company's module settings page, over
`minty-billing-api`. Since 2026-09-29 it also has the entity list ("Select Company", the hub's
first page) and My Profile, over Flask's bearer routes — Part 3 step 4, pulled forward; login,
the dashboard and settings follow in Part 3. Written for
someone new to the codebase; the plan (`Minty/docs/modernisation/modernisation_plan.md`) and
the sibling repos' `docs/features/` folders are linked, not repeated.

| Feature                                                                                                                                                  | Document                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Getting in: the module token, the cookie, the two gates in `proxy.ts`, the re-handoff, what this app never does                                          | [authentication.md](authentication.md) — Minty's `docs/features/authentication.md` has the system-wide picture                                                            |
| The subscription feature: the pages, the bounded folder and its three rules, the API clients, the switch, card capture, tests, and which step fills what | [subscriptions.md](subscriptions.md) — `features/subscription/README.md` holds the extraction recipe; `minty-billing-api/docs/features/subscriptions-api.md` the contract |
| The entity list ("Select Company"): where it comes from, the cards, what Flask flashed on the way, the header and the side menu on every page | [entities.md](entities.md) — `features/entities/README.md` holds the extraction recipe |
| My Profile: the Figma 10-A/10-B page, editing in place, the subscription feature's card in its slot | [profile.md](profile.md) — `features/profile/README.md` holds the extraction recipe |

Running it: `npm run dev` on 3002 with `.env.local` (the four `NEXT_PUBLIC_*` in
`.env.example`); tests `npm test` (Vitest, 29 on 2026-09-21) and `npm run test:e2e` (Playwright,
stack up — `e2e/README.md`). Skeletal by decision: a new design replaces `components/` later
without touching `api/`, `hooks/` or the tests.

Keep these current: when a route, a rule or a test named here changes, change the line that
names it in the same commit. `subscriptions.md` §8 says which step fills which part; move a row
out of it when the step lands.
