---
name: pr-review-backlog
description: >
  Use when clearing or triaging a BACKLOG of many open PRs in one session — "review all the open
  PRs", "go through the PR backlog", "what's mergeable", "let's clear these PRs", mass/batch PR
  review — as opposed to one specific PR (for a single PR, use review-pr). Runs a topology-first
  triage of the whole set (author, stacks, merge-commit poison, conflicts), then batch-reviews by
  author/stack with one durable artifact per batch and an approve / don't-approve call per PR.
  DEFAULT IS REVIEW-ONLY. Resolving conflicts, rebuilding, or merging the authors' branches is
  opt-in and exceptional — only when the user explicitly asks you to land them.
---

# Skill: pr-review-backlog

## Purpose

Clear or triage a backlog of many open PRs efficiently, without reviewing them blindly one-by-one and without regressing `main`. The win comes from mapping the whole set first, then reviewing in batches that share context (especially stacks), so each artifact covers several PRs at once.

Done when:

- every open PR is triaged and classified (Phase 1)
- batches are reviewed with a durable artifact each and an approve / don't-approve call per PR (Phase 2)
- only if the user actually asked to land them, eligible PRs are merged without regressing `main` (Phase 3)

## Two modes — default to review

- **Review (default, the normal case).** Triage → batch-review → artifact + approve/don't-approve → hand back. You are **not** editing, rebuilding, or merging the authors' branches. Most backlog sessions stop here.
- **Resolve & merge (opt-in, exceptional).** Only when the user explicitly says to fix/rebuild/land the PRs. Fixing someone else's PR on their behalf is unusual — don't assume it. When asked, follow `references/resolve.md`.

If unsure which mode you're in, you're in review mode. Ask before touching an author's branch.

## Phase 1 — Topology triage (always first)

Before reviewing any single PR, map the whole set into one table. The order and method for everything downstream falls out of this — skipping it means rediscovering the structure the hard way, mid-review.

Per PR gather: author, base branch (base ≠ `main` → it's stacked), merge-base age, **merge-commits in history** (the poison flag), and mergeable state + which files conflict. Then classify each PR. Full commands and the classification decision tree are in `references/triage.md`.

The classifications that change what you do:

- **clean-mergeable** — no conflicts; ready (subject to the gate rules).
- **linear stack** — each PR based on the previous; review and (if landing) handle as a unit.
- **sibling fan** — several PRs based on one shared parent; they look like a stack but aren't.
- **merge-commit-poisoned** — has merge commits in its history; needs special handling and must never be `but apply`-ed (it corrupts the GitButler workspace).
- **stale-base / structural-rewrite** — the PR's version of a file and `main`'s are now different artifacts (big size delta); it's a re-author, not a merge.

## Phase 2 — Batch review + artifacts

- **Group before reviewing.** By author first. A **stack is always one batch** — reviewing it as a unit is mandatory, because a later PR's rationale lives in its ancestors. Batch large single-author sets too; group across authors only when they share a clear theme.
- **One durable artifact per batch, not per PR.** That's the whole point — it avoids the slow one-by-one grind. Each artifact carries an approve / don't-approve call per PR with the evidence. Match its length to the batch: enough evidence per PR to justify the call, no padding, no repeated boilerplate across PRs that share the same context. Follow the artifact + branding rules (brand resolved by the `brand-guidelines` skill), run the humanizer pass and the Playwright visual-QA loop.
- **Delegate deep single-PR dives to `review-pr`** when one PR needs evidence-level scrutiny.
- **Honour session-scoped rules the user sets** — e.g. "skip PRs where X is the reviewer unless I'm also assigned." These are per-session; never bake a specific person or rule into this skill.

## Phase 3 — Resolve & merge (only when explicitly asked)

This is the opt-in path. Read `references/resolve.md` for the full patterns. The decision tree, in short:

- **clean-mergeable** → merge per the gate rules.
- **linear stack** → rebuild the **deepest** PR onto `main` (it carries its ancestors), merge once, then close the subsumed PRs with a note. Don't rebuild each link.
- **sibling fan** → rebuild **each** PR onto `main` individually; "merge the last" does nothing here.
- **merge-commit-poisoned** → never `but apply`; rebuild via file-ops on a fresh branch.
- **stale-base / structural-rewrite** → take `main`'s file, graft the PR's genuine new feature onto it, drop its now-obsolete baggage, and flag it for a dry-run if it's deploy-critical.
- **always verify the PR's intent survived the rebuild** — markers-clean is not enough.

## Boundaries

- Default to review-only. Never edit, rebuild, or merge an author's branch unless the user explicitly asks — surfacing a conflict is the job, fixing it usually isn't.
- All local git work goes through the `gitbutler` skill (`but`); stay on `gitbutler/workspace`.
- Artifacts follow the artifact + branding rules; prose gets the humanizer pass and the visual-QA loop.
- Flag any deploy-critical change you authored but couldn't run as needing a dry-run before it's relied on.
