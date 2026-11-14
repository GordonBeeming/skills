# Depth matrix

Shared rules: review-contract.json, review-common.md and the named mode reference. Auto selects
Deep for XL or larger, more than 2,000 non-noise changed lines, or high risk; otherwise Standard.
Ultra is never automatic, including unattended runs, follow-ups and retries.

| Mode | Review | Verification | Output |
|---|---|---|---|
| quick | One blocker-check pass, every hunk | No extra pass | Always hold; never approve |
| standard | One reviewer, every hunk and surrounding code | Code and existing CI evidence; narrow checks only if available | Findings and verdict |
| deep | One thorough reviewer, entire PR, callers, base/head, discussions and prior findings | Verify code evidence and completeness; preserve caveats | Findings and verdict |
| ultra | Six independent seats from panel.md | One dedicated verification and deduplication pass | Full report included in authorised PR comment/review body |

Standard and Deep may review batches. Ultra requires an explicit request naming one PR or branch;
it is unavailable for blind review or an entire backlog. Unattended snapshot callers use
unattended.md and never run commands or publish from the model process. A missing Ultra seat or
verification pass is a failure, not a downgraded review.

## run.json

Shape from the shared v1 contract, with `mode` carrying the review switches.

```json
{
  "skill": "review",
  "version": 1,
  "startedAt": "", "endedAt": "",
  "source": "<pr url | branch | backlog | dependabot>",
  "repo": "<owner/repo>", "pr": 0, "headRefOid": "",
  "size": { "large": false },
  "coverage": { "complete": false, "skipped": [] },
  "profile": "<org>",
  "worktree": "",
  "mode": {
    "gates": [],
    "chosenBy": "question|flag",
    "depth": "quick|standard|deep",
    "depthAuto": false,
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
      "expert": "security|bugs|sre|cost|conventions|tests|lead|claude|agy|grok",
      "title": "SQL query built by string concatenation with request input",
      "severity": "Blocker|High|Medium|Low",
      "data_integrity": false,
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

## Ultra verification confidence

Read the shared rubric in `ultra.md` and threshold in `review-contract.json`.

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
