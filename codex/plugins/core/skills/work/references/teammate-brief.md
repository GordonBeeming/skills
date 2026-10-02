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
- Conventions: <from AGENTS.md / CLAUDE.md; the ones this work touches>

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

`codex` (`spawn_agent`, name `<id>`, model from the table when the schema exposes one):

> You are `<id>` on the `<slug>` run. Read `<abs>/shared-context.md` then `<abs>/spec-<id>.md`. Build
> exactly what the spec says. When the completion condition holds and the verification commands pass,
> send the report shape to `team-lead` with `send_message`. Later feedback arrives by `send_message`;
> apply it and report again.

`claude` and `agy` (runner scripts, `--mode build`): the prompt file is `spec-<id>.md` with
shared-context.md prepended. The runner writes the report JSON; the lead reads `response` for the
report body and keeps the session or conversation id for `--resume`.

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
may touch. `codex`: `send_message`. `claude` / `agy`: the runner with `--resume <id>` and this message
as the prompt file. Two rounds per workstream, then the lead marks it `failed` and moves on.
