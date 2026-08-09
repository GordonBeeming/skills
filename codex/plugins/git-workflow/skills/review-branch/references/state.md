# State & iteration model

The review is a loop that can span several turns and context windows. Git is the state backbone; two
artifacts-dir files carry the review's own memory across iterations.

## Location

Alongside the HTML artifact, under `~/Developer/artifacts/<project>/review-branch/`:

```
findings-iter<N>.json     # structured findings for iteration N
progress.md               # freeform running notes across all iterations
```

Keep the JSON structured (schema below) and the notes freeform — structured data for deltas, prose for
context and rationale.

## Finding schema

Every expert returns a JSON array of findings shaped like this (also the schema handed to finder
subagents). Keep field names exactly as below so dedup and the artifact can consume them:

```json
{
  "id": "sec-001",
  "expert": "security",
  "title": "SQL query built by string concatenation with request input",
  "severity": "High",
  "confidence": 70,
  "file": "src/Api/Handlers/SearchHandler.cs",
  "line": 42,
  "evidence": "cmd.CommandText = \"… WHERE name = '\" + query + \"'\"; — `query` flows from the request body unescaped.",
  "impact": "SQL injection; attacker can read/alter arbitrary rows.",
  "suggested_fix": "Use a parameterized query / the existing repository helper.",
  "needs_run": true,
  "status": "open"
}
```

Field notes:

- `severity` ∈ `Blocker | High | Medium | Low` (definitions in `artifact.md`).
- `confidence` — the finder's own 0–100 estimate. The verify stage overwrites this with its score.
- `needs_run` — finder's flag that behavioural proof is warranted (verify stage decides whether to run).
- `status` after verification ∈ `confirmed | filtered | false-positive`.
- `line` — anchor line in the head/working version; use the start line for a range.

## Iteration delta

On a re-review, compare the new findings against the previous iteration's `findings-*.json` by
`(file, normalized-title)` and classify each:

- **fixed** — was confirmed last time, absent now (verify it's genuinely resolved, not just moved).
- **regressed** — was fixed/absent, present again now.
- **new** — not seen in any prior iteration.
- **carried** — still present (note if severity/confidence changed).

Surface the delta in the artifact's exec summary and in the final response.

## Bulletproofness score

A single 0–100 headline the exec summary leads with, so the trend across iterations is legible:

```
score = 100
      − 40 × (confirmed Blockers)
      − 15 × (confirmed High)
      −  5 × (confirmed Medium)
      −  1 × (confirmed Low)
      − 10   if any escalated verification failed
      − 10   if a critical/production path finding could not be verified by running
score = clamp(score, 0, 100)
```

Report the number **and** the arithmetic, and the delta vs the previous iteration. It is a
communication aid, not a gate — the gate is "no confirmed finding at or above the bar, escalated
verifications green." Tune the weights per repo in `.review-branch.md` if needed.

## Progress notes (`progress.md`)

Freeform, append one block per iteration:

```
## Iteration N — <date>
Scope: <siding/branch vs base>, <N files>
Experts run: correctness, security, … (+ triage-selected)
Confirmed: <counts by severity>   Score: <X> (Δ <±Y>)
Verified by running: <commands + results>
Approved & implemented: <summary of the fixes that landed>
Deferred / user-dropped: <findings the user chose not to fix, + why>
Next: <recommendation on re-review>
```
