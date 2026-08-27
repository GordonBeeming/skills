# Verification — the precision gate

Finders optimize for coverage; this stage optimizes for precision. It dedups, scores, and — when a
finding's truth depends on runtime behaviour — **runs the code to settle it** rather than reasoning.
Nothing is silently dropped: everything below the bar lands in the filtered appendix.

## 1. Dedup

Merge findings that describe the same issue at the same place. Key on `(file, nearby line, normalized
title)`. When experts overlap (e.g. correctness + security both flag the same unsafe parse), keep one
finding, keep the highest severity, and record the contributing experts.

## 2. Score each finding (0–100 confidence)

Reuse the official code-review rubric. Give the scorer this verbatim:

- **0** — Not confident at all. False positive that doesn't survive light scrutiny, or a pre-existing
  issue not introduced by this change.
- **25** — Somewhat confident. Might be real, might not; couldn't verify. If stylistic, not explicitly
  called out in the relevant CLAUDE.md.
- **50** — Moderately confident. Verified real, but may be a nitpick or rare in practice; not important
  relative to the rest of the change.
- **75** — Highly confident. Double-checked; very likely real and hit in practice; the current approach
  is insufficient. Important, or directly named in the relevant CLAUDE.md.
- **100** — Certain. Confirmed a real issue that will happen frequently; evidence directly confirms it.

Rules:

- For any finding derived from a CLAUDE.md / AGENTS.md rule, **open the file and confirm the rule
  actually says it.** If the rule is silenced in-code (lint-ignore, explicit opt-out comment), drop it.
- Discard findings on lines the change did not touch (pre-existing issues) unless the change makes them
  reachable/worse — if so, keep and say why.
- The scorer's number **overwrites** the finder's `confidence`.

## 3. Escalate to running it (when it matters)

Static reading is the default. Escalate a finding to behavioural proof when **any** of:

- The finding asserts runtime behaviour whose truth a careful read can't settle.
- It sits on a **critical or production path** (auth, payments, data writes, migrations, anything whose
  failure is user-visible or hard to reverse).
- The user asked for it this round.

How to run:

- **In a shunt siding** → drive the guest with `shunt-dev run <cmd>` (e.g. `shunt-dev run sh -c
  "dotnet test --filter …"`, `shunt-dev run aspire logs`). Never the host shell for guest processes.
- **Main repo / plain checkout** → the narrowest build/test/static-check that exercises the changed
  behaviour. Prefer a single targeted test over the whole suite.
- Reuse project skills where they exist (e.g. a client project `aspire`, `test-writer`, `db-query`).

Record the exact command and its real result on the finding — including failures and skips. A green
check is data, not proof the finding is resolved; connect the result back to the specific claim.

**A new check must not measure with the construct it is checking.** When a finding is "this construct
is wrong", the test written to prove it is fixed reaches for the nearest idiom to inspect the
result — and the nearest idiom is very often the broken one. A test guarding against pattern matching
that fails on certain inputs, written with a pattern match to count the result, fails on exactly the
inputs it exists to cover. It then reports a defect in code that is correct, and the obvious next move
is to "fix" the code.

So when a fresh check fails on its first run, suspect the check before the change, and confirm the
measurement independently: assert with plain string equality, an explicit loop, or a different tool
from the one under test. The tell is a failure that reproduces the exact shape of the original bug in
the assertion rather than in the behaviour.

The inverse holds too. A check that passes immediately proves nothing until you have seen it fail:
break the fix, watch the check go red, restore. A green assertion that never had the chance to be red
is indistinguishable from one that does not test anything.

## 4. Classify and bar

- `confidence ≥ 80` **and** at/above the severity bar (default ≥ Medium) → **confirmed** → main report.
- Everything else → **filtered** → appendix (kept visible, never deleted).
- `confidence = 0` verified false → **false-positive** → appendix, briefly noted so the reasoning is
  auditable.

The default bar (≥ Medium confirmed, escalated verifications green) is the "bulletproof" gate. Tune the
threshold per repo via `.review-branch.md`.

## 5. Hand off

Emit the classified, deduped findings as the `findings-iter<N>.json` per `references/state.md`, ready
for the artifact and the plan gate. Only **confirmed** findings become proposed changes in the plan;
the appendix is for observability, not action, unless the user promotes something from it.
