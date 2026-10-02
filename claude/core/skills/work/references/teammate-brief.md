# Teammate brief

Two files per run, written by the lead before the first wave: one `shared-context.md` for everyone,
one `spec-<id>.md` per workstream. Each teammate's prompt points at both by absolute path and says
nothing the files already say.

## shared-context.md

```markdown
# Shared context: <run slug>

## Repo
- Root: <worktree path>. Work only here.
- Map: <the directories that matter, one line each>
- Conventions: <from CLAUDE.md / AGENTS.md; the ones this work touches>

## Hard rules
- Edit only the files your spec owns. Anything else is a report line, not an edit.
- No git writes of any kind: no commit, no branch, no stash, no checkout. The lead commits.
- No app launches. The lead runs the app under the environment lock.
- No edits to skills, rules, or config files. No notes-to-self anywhere.
- Deliver what the spec asks. Extra scope goes in the report as a suggestion.

## Verification everyone runs before reporting
- `<command>` (typecheck)
- `<command>` (tests scoped to the owned paths)
- `<command>` (format check, when the repo's CI runs one)

## Report shape
See "Teammate report" below. Send it once, when the completion condition in the spec is met, or
when you are genuinely blocked.
```

## spec-<id>.md

```markdown
# <id>: <one-line title>

## Owns
- <path glob>
- <path glob>

## Build
<what to build, in the order it should land; the interfaces it must match; the behaviour it must
show; what it must not touch>

## Completion condition
<one sentence: the observable state that means done>

## Verification
- `<command>` and the result that means pass
- `<command>`

## Report
The teammate report shape from shared-context.md.
```

## Prompt per kind

`team` (Agent tool, `name: <id>`, `model` from the table):

> You are `<id>` on the `<slug>` run. Read `<abs>/shared-context.md` then `<abs>/spec-<id>.md`. Build
> exactly what the spec says. When the completion condition holds and the verification commands pass,
> write the report shape to `<run dir>/reports/<id>.md` first (that file is what "done" means to the
> lead), then send the same text to `team-lead` with SendMessage. Later feedback arrives by
> SendMessage; apply it, overwrite the report file, and message again.

`agent` (Agent tool one-shot, `model`, optional `isolation: "worktree"`):

> Read `<abs>/shared-context.md` then `<abs>/spec-<id>.md`. Build exactly what the spec says, run the
> verification commands, write the report shape to `<run dir>/reports/<id>.md` (that file is what "done"
> means to the lead), and return the same text as your final message. You will not be messaged
> again; do not wait for anything.

`codex` and `agy` (runner scripts, `--mode build`): the prompt file is `spec-<id>.md` with
shared-context.md prepended. The runner writes the report JSON; the lead reads `response` for the
report body and keeps the thread or conversation id for `--resume`.

## Teammate report

```
<id> report
Files changed: <path>, <path>
Verification: <command> -> <pass/fail, one line of output>
Skipped: <what and why, or "nothing">
Uncertain: <what the lead should look at first, or "nothing">
```

## Feedback round

Lead to teammate, one message, three parts: the problem (file and line), the fix shape, the files it
may touch. `team`: SendMessage. `agent`: a new one-shot Agent call carrying the spec path plus this
message. `codex` / `agy`: the runner with `--resume <id>` and this message as the prompt file. Two
rounds per workstream, then the lead marks it `failed` and moves on.
