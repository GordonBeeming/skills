---
name: blind-review-pr
description: >
  Explain what a pull request actually changes, read from its hunks alone (no title, body, labels,
  linked issues, review comments, or commit messages), then split the change into its core shift and
  everything downstream of it, as a durable HTML artifact. Only invoke when the user explicitly types
  `/blind-review-pr`. Never trigger on a pasted PR URL, "what does this PR do", "explain this PR", or
  a plain "review this PR" — that all belongs to review-pr, which reads the description and the review
  threads and gives a verdict. Not a quality review: no severity ranking, no approve/reject verdict,
  no GitHub comments, no code edits.
---

# Skill: blind-review-pr

## Purpose

Produce an independent read of a PR's code: what the change is, how it's structured, and what it
implies, owing nothing to how the author described it.

The reading order is the whole method. A description tells you what the author meant to build; the
hunks tell you what's actually there, including the parts nobody wrote down. Reading the description
first is hard to undo, because from then on you're checking the code against a story instead of
deriving one.

Done when every hunk has been read, the change is split into core and secondary, every number in the
artifact was counted rather than estimated, and the artifact has been rendered and visually checked.

## The evidence boundary

This is the skill. Don't soften it.

**Read the code with:**

- `gh pr diff <n>` — **not** `--patch`, which prepends every commit's subject and body. Those are author
  narrative and they're persuasive; keep them out.
- `gh pr view <n> --json changedFiles,additions,deletions` — numbers only, for the counts.
- When a later commit fixing an earlier one matters (a real thing to notice), get the SHAs with
  `gh pr view <n> --json commits --jq '.commits[].oid'` and diff each commit's *code*. Never its message.
- Add `-R <owner>/<repo>` when working outside the repo.

**Off-limits as input:** PR title, body, labels, linked issues, review comments and threads, check
output, commit messages. If one of these is already in context from earlier in the session, don't lean
on it, and say so in the final response rather than pretending it wasn't there.

**Fair game, and usually necessary:**

- **Unchanged code in the repo.** A hunk often can't be understood alone, because the caller that
  decides how often a changed method runs is frequently untouched by the PR. Read it — locally when the
  repo is checked out, otherwise `gh api repos/{owner}/{repo}/contents/{path}?ref=<base>`.
- **Comments and doc comments inside the diff.** They're changed lines, and code documenting its own
  constraints is evidence about the change. Prose *about* the change is not.

## Workflow

1. **Resolve the PR** — URL or number.
2. **Fetch the diff and the counts.** Write the diff to the scratchpad when it's big enough that you'll
   grep it more than once.
3. **Read every hunk.** Full coverage first; no filtering yet.
4. **Fill the context gaps** — for each hunk whose effect you can't state without more, read the
   surrounding code.
5. **Rank in a separate pass** using the taxonomy below. This is deliberately a second pass: deciding
   what matters while you're still discovering what's there produces a summary of whatever you read
   first.
6. **Count mechanically** (see below).
7. **Build the artifact** — read `references/artifact.md` first.
8. **Render and visually check it** (the browser-driven visual QA loop, per the active Codex instructions).
9. **Reply** with the artifact link and a tight summary.

Don't delegate the read. The value is one coherent pass that finds the through-line, and splitting the
diff across subagents fragments exactly the judgement this skill exists to apply. A large diff gets
several passes by you, not several readers.

## Taxonomy: core vs secondary

Sort every change into:

1. **The core change** — the shift everything else is downstream of. The test: remove it, and do the
   rest still have a reason to exist? Usually one, occasionally two.
2. **What the core forces** — substrate swaps, new seams, new abstractions that only make sense because
   of the core.
3. **The call-site sweep** — the N places that had to be touched. A table. When *where in the method*
   the change landed is the interesting part, that's the column that earns its place.
4. **Carried along** — visibility changes, extracted helpers, DI registration, comment corrections:
   changes that exist only so the core compiles or can be tested.
5. **Consequences the code reveals** — asymmetries, new costs, behaviour that holds in one direction but
   not the other, paths that deliberately didn't get the new treatment. Describe them plainly; don't
   grade them. This bucket is where reading blind pays for itself, because a description rarely lists
   them.
6. **What the tests pin** — read the tests as a statement of intent. A test that fails only if a
   specific line moves is telling you that ordering is load-bearing.

The taxonomy is a lens, not a mandatory skeleton. Small PRs collapse 1 and 2 into one section and skip
buckets that are empty. Never pad the artifact to fill all six.

## Counting rule

Every number in the artifact is derived mechanically: `grep -c` over the saved diff, or the counts from
`gh pr view`. Never estimate a count from having read the thing; a plausible wrong number is worse than
no number, because it reads as authority.

## Boundaries

- **Not a review.** No severity model, no blocker/high/medium ranking, no approve/reject verdict. Naming
  a consequence the code has is in scope; grading it isn't. If the user wants findings and a verdict,
  that's `review-pr`.
- Don't post anything to GitHub, and don't edit the PR's code.
- Don't hunt for bugs. If a hunk plainly contradicts itself, say what the code does and move on; the
  artifact describes, it doesn't prosecute.
- Deliver the blind review that was asked for. Don't expand into fix suggestions, follow-up tickets, or a
  refactor proposal.

## Output

**The artifact** carries the detail: substance, no filler sections, no redundant closing summary. Scale
it to the change: a two-file PR gets one core section and a short table, not six sections of padding.

**The reply** leads with the core change in a sentence or two, then the secondary structure briefly, then
the consequences worth knowing. Someone should be able to act on it without opening the artifact, but it
isn't a re-narration of it. Say which evidence you used, and name anything you couldn't determine from
the hunks plus surrounding code.
