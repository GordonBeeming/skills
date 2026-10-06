# Depth matrix

What each depth does at each step, exactly. The spine names the steps; this file is the contract.

## Depth by step

| Step | quick | standard | deep |
|---|---|---|---|
| 0 menu | same | same | same |
| 1 resolve | same | same | same |
| 2 gather | diff, PR state, threads, checks, context | same | same |
| 3 review | lead reads every hunk, writes every finding | same, plus `needs_run` flags | five-seat panel in parallel, plus `--reviewer` runner pass; lead merges |
| 4 verify | skipped (depth quick) | CI results first; a local run only for a `needs_run` finding CI cannot answer, and only the narrowest test for it | one verification pass: dedup, score, rule check, the same CI-first validation |
| 5 rank | verdict, Blockers only in chat | verdict, counts, top findings in chat | same as standard, over `confirmed` findings |
| 6 artifact | skipped (depth quick) | HTML artifact | HTML artifact with per-seat detail, verification log, filtered appendix |
| 7 write-back | as chosen | as chosen | as chosen |
| 8 fix plan | skipped (depth quick) | skipped (depth standard) | `fix-plan.md` for `$work` |
| 9 report | from run.json | from run.json | from run.json |

Cost: `quick` is one pass on the session model. `standard` is one pass, CI's own results, and at most a few narrow local runs; it never repeats the build or test suite CI already ran.
`deep` is five `gpt-5.6-sol` agents, one optional runner, and the verification pass.

## Target by depth

| Target | quick | standard | deep | `--blind` |
|---|---|---|---|---|
| PR | yes | yes | yes | yes (quick or standard) |
| branch | yes | yes | yes | yes (quick or standard) |
| `backlog` | yes | yes | refused at step 0 | refused |
| `dependabot` | yes | yes | refused at step 0 | refused |

`backlog` at `quick` is triage plus one quick pass per PR and an approve or hold call in chat.
`backlog` at `standard` adds targeted validation where a checkout exists and one artifact per batch.
`dependabot` at `quick` is the classification table; `standard` also reads each diff for source
changes beyond the manifest and lockfile and checks the advisory links in the PR body.

`--reviewer` at `standard` runs the runner pass alongside the lead's read and the lead merges both
before step 4. At `deep` it is a sixth source into the same verification pass.

## run.json

Shape from the shared v1 contract, with `mode` carrying the review switches.

```json
{
  "skill": "review",
  "version": 1,
  "startedAt": "", "endedAt": "",
  "source": "<pr url | branch | backlog | dependabot>",
  "profile": "<org>",
  "worktree": "",
  "mode": {
    "gates": [],
    "chosenBy": "question|flag",
    "depth": "quick|standard|deep",
    "writeBack": "none|post|approve",
    "blind": false,
    "reviewer": "",
    "focus": ""
  },
  "workers": {
    "pool": ["codex"],
    "composition": [
      { "id": "bugs", "kind": "codex", "model": "gpt-5.6-sol", "role": "review",
        "justification": "a reviewer that under-reports produces wrong approvals; the panel is the one place not to economise" }
    ]
  },
  "steps": [
    { "id": "menu", "status": "pending", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "resolve", "status": "pending", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "gather", "status": "pending", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "review", "status": "pending", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "verify", "status": "pending", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "rank", "status": "pending", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "artifact", "status": "pending", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "write-back", "status": "pending", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "fix-plan", "status": "pending", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "report", "status": "pending", "reason": "", "startedAt": "", "endedAt": "" }
  ],
  "outputs": { "plan": "", "pr": "", "artifact": "", "report": "" }
}
```

`workers.composition` is empty at `quick` and `standard` with no `--reviewer`. A runner row is
`{ "id": "claude", "kind": "claude", "model": "sonnet", "role": "review", "justification": "" }`.
`outputs.plan` holds the fix plan path at `deep`.

## findings.json

```json
{
  "target": "<pr url | branch>",
  "base": "<default branch>",
  "verdict": "approve|hold|none",
  "brief": { "focus": "", "result": "meets|partial|fails" },
  "findings": [
    {
      "id": "sec-001",
      "expert": "security|bugs|sre|conventions|tests|lead|claude|agy",
      "title": "SQL query built by string concatenation with request input",
      "severity": "Blocker|High|Medium|Low",
      "confidence": 70,
      "file": "src/Api/Handlers/SearchHandler.cs",
      "line": 42,
      "evidence": "the offending expression quoted from the code, and how the value gets there",
      "impact": "what goes wrong, for whom",
      "suggested_fix": "the concrete change",
      "needs_run": true,
      "status": "open|confirmed|filtered|false-positive|unverified",
      "verification": "command run and its result, when any"
    }
  ]
}
```

Every reviewer returns the `findings` array only. `line` is the anchor in the head version; the
start line for a range. `confidence` is the finder's own guess until step 4 overwrites it.

## What counts as a finding

A defect in the code the diff changed, stated with `file:line`. The state of CI is not a finding at
any depth: a failing check is followed to the code and reported as the defect it exposes, or left
out with a line in the notes when it is flaky, infrastructural, or inherited from the base branch.

## Scoring rubric (deep, step 4)

- **0**: false positive on light scrutiny, or a pre-existing issue the change did not introduce.
- **25**: might be real, could not verify; a style point no rule file names.
- **50**: verified real, likely a nitpick or rare in practice.
- **75**: very likely real and hit in practice; the current code is insufficient, or a rule file
  names it directly.
- **100**: certain; the evidence directly confirms an issue that will happen.

`confirmed` at 80 or above. The number goes on the finding and overwrites the finder's confidence.

## Blind taxonomy (`--blind`, step 3)

Sort every hunk into these buckets, in this order. Empty buckets are omitted; small changes collapse
the first two.

1. **The core change**: the shift everything else is downstream of. Remove it and the rest has no
   reason to exist. Usually one, sometimes two.
2. **What the core forces**: new seams, substrate swaps, abstractions that only make sense because
   of the core.
3. **The call-site sweep**: the places that had to be touched, as a table. "Where in the method" is
   a column only when it varies.
4. **Carried along**: visibility changes, extracted helpers, registrations, comment corrections.
5. **Consequences the code reveals**: asymmetries, new costs, paths that did not get the new
   treatment. Described, never graded.
6. **What the tests pin**: the tests as a statement of intent; a test that fails only if one line
   moves says that ordering is load-bearing.

Unchanged code in the repo is fair game and usually necessary. Prose about the change (title, body,
threads, commit messages) is not. Ranking happens as a second pass after every hunk has been read.
