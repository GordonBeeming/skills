# Triage — which experts run

The panel is **core always-on + dynamic add-ons**. Always run the core. Add each dynamic expert only
when the diff shows its signal — this keeps the panel bounded and the noise low. When unsure whether a
signal is present, include the expert (coverage bias); the verify stage filters false alarms.

## Core (always run)

| Expert | File | Angle |
| --- | --- | --- |
| Correctness | `experts/correctness.md` | Logic bugs, edge cases, error handling, null/None, off-by-one |
| Security | `experts/security.md` | Injection, authz/authn, secrets, unsafe input, crypto |
| SRE / Observability | `experts/sre-observability.md` | Prod-supportability: logging levels, metrics, traces, failure modes |
| Conventions | `experts/conventions.md` | Repo style/formatting, CLAUDE.md/AGENTS.md adherence |
| Code hygiene | `experts/code-hygiene.md` | Comment discipline, readability, naming, needless complexity |

## Dynamic add-ons (run when the signal is present)

| Signal in the diff | Add expert | File |
| --- | --- | --- |
| DB migrations, schema, SQL, ORM entities, data backfills | Data integrity | `experts/data-integrity.md` |
| Public API surface, DTOs, routes, RPC/gRPC, event contracts, serialization | API contract | `experts/api-contract.md` |
| Hot paths, loops over large sets, N+1 risk, allocations, caching, queries | Performance | `experts/performance.md` |
| Threads, tasks, async/await, locks, shared mutable state, queues | Concurrency | `experts/concurrency.md` |
| UI components, templates, markup, styles, user-facing copy | Accessibility / UX | `experts/accessibility.md` |
| New/changed behaviour with thin or missing tests | Testing | `experts/testing.md` |
| Dependency manifest changes, new packages, version bumps | Dependencies | `experts/dependencies.md` |

## How to decide

1. List the changed files and their extensions/paths from the resolved diff.
2. Skim the diff for the signals above (a fast scan, not a deep read — the experts do the deep read).
3. Union the matched dynamic experts with the core set. De-dupe.
4. Record the chosen roster in `progress.md` so the selection is observable and tunable.

## Per-repo overrides

If the target repo has a `.review-branch.md` (or, failing that, relevant guidance in `CLAUDE.md` /
`AGENTS.md`), honour it: it may add always-on experts (e.g. a11y always-on for a frontend repo), remove
irrelevant ones, or adjust the reporting bar. Repo config wins over these defaults.

## Adding an expert

Drop a new `experts/<name>.md` (follow the shape of the existing persona files) and add a row here with
its triggering signal. No change to `SKILL.md` is required.
