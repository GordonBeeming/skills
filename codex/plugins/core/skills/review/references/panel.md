# The panel

Six seats, fixed. Each is one `spawn_agent` call at `ultra`, launched together in one message with
model `gpt-5.6-sol`. Severity definitions live in the spine (step 5); the finding schema in
`references/depth-matrix.md`.

## The coverage instruction

Every seat, every backlog reviewer, and every runner prompt carries this verbatim:

> Report every issue you find, including ones you are uncertain about or consider low-severity. Do
> not filter for importance or confidence at this stage; a separate verification step does that.
> Your goal is coverage: a finding that later gets filtered out costs less than a real bug silently
> dropped. For each finding include your confidence (0 to 100) and an estimated severity so a
> downstream pass can rank them.

## Roster

| Seat | Question | Also covers |
|---|---|---|
| bugs | does this do the right thing for every input it can receive? | concurrency, data integrity, wire-contract breaks |
| security | can untrusted input, a missing check, or an exposed secret let someone do something they should not? | dependency usage patterns |
| sre | at 3am, can the on-call engineer see and stop this failure? | timeouts, retries, resource bounds |
| conventions | does this match how this repo does things? | code hygiene, comment discipline, manifest hygiene |
| cost | what does this cost every time it runs, in production and in the test suite? | background jobs and retries, waits, test doubles that block, N+1, unbounded growth |
| tests | if this regresses next month, does a test fail? | |

Accessibility and UX are not a seat; a UI change needs a separate, dedicated UX pass.

## What every seat is handed

```text
You are the <seat> seat on a code review panel. Read the brief below, then the diff at
<abs path>/diff.patch and the context at <abs path>/context.md (it lists the repo's AGENTS.md and
CLAUDE.md paths; open them). Read the base-branch code around every hunk before judging it; a diff
line alone is not enough context to call a bug.

Read-only. No file edits, no git network commands (fetch, pull, checkout, gh pr checkout), no posts.

<coverage instruction>

Return only a JSON array of findings in this schema: <schema>. Every finding carries a file and
line. Set needs_run where only a build or test can settle it.

<seat brief>
```

## Seat briefs

Read `references/review-panel.md` for the shared briefs of all six seats.

## Runner prompt (`--reviewer`)

`runner/<name>.prompt.md` is a generalist version of the seat prompt: the same header (paths,
read-only, no git network commands), the coverage instruction, the schema, and this brief: "Review
the diff from every angle: correctness, concurrency, data, security, observability, runtime cost (background jobs, retries,
waits, test helpers that block), conventions in
the repo's own rule files, and tests. End your reply with the JSON array and nothing after it."
The runner report's response field carries the reply; the lead extracts the array. A report with no
parseable array is `failed (no findings array)` for that pass, and the report names it.

## Backlog reviewer prompt

Same header and coverage instruction, one PR per agent, plus: "Return the findings array and,
before it, two or three plain sentences on what the PR actually does: what changes and why the
diff says it had to. Not the title reworded." That summary is what makes a batch artifact readable
by someone who was not watching.
