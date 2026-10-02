# Plan template

The plan file is `<run dir>/plan.md`. With the `plan` gate the same content goes through Codex Plan
mode. Sections in this order, none skipped. A section with nothing to say holds one line saying so
("No open risks."). Length follows the work: cover the substance, no recap of the source, no filler.

```markdown
# <title: the work in one line, issue number first when there is one>

## Team

| Id | Kind | Model | Role | Owns | Notes |
|---|---|---|---|---|---|
| ws-api | codex | luna | build | src/api/**, tests/api/** | |
| ws-migrate | codex | sol | build | migrations/** | Justification: <what luna could not do here> |
| rev-claude | claude | sonnet | review | read-only, whole diff | claude-run --mode review, max 3 rounds |
| ws-docs | agy | gemini-3.8-flash-low | build | docs/** | agy-run --mode build |

Waves: ws-api and ws-docs in parallel; ws-migrate after ws-api because both touch
src/db/schema.ts. rev-claude runs once every build row is accepted.

## Gates

Active gates: plan, test. (or: none, mode auto)

## Design

- <`canvas`: the /design canvas is the first workstream, these screens, User refines it before any
  code | `none`: straight to code, because <why> | `n/a`: nothing visible changes>

## Context

- Source: <URL, or the quoted phrases, or the spec path>
- What the research found: <the files, the current behaviour, the constraint that shapes the fix>
- Bug reports only: the fault in one sentence, and which of the report's claims were confirmed,
  refuted, or could not be checked.

## Approach

<the strategy; name a real alternative in one line when one exists and say why it lost>

## Workstream specs

### ws-api
- Owns: <paths>
- Scope: <what to build, what to leave alone>
- Verification: `<command>`, `<command>`
- Reports: files changed, verification output, anything skipped or uncertain

### ws-migrate
...

## Testing

- Suites: `<command>`
- End to end: <the flow the lead drives after integration, and what it must show>
- Environment: <env.lock name when set; scratch data only>

## Risks

- <risk, and what is done about it>
- Open question for the gate: <a convention the work would break, with the cost of breaking it and the
  option to conform>

## Glossary

- <term>: <meaning>, alphabetical, every acronym and domain word used above
```

## Rules the table encodes

- Kinds come from the ticked pool only (`codex`, `claude`, `agy`). Model is explicit on every row.
- `Justification:` is mandatory on any `codex` row above `luna` and on any Antigravity row above
  `gemini-3.8-flash-low`.
- Owned paths never overlap inside a wave. Overlap forces a later wave or a fresh worktree for one of
  the overlapping `codex` rows.
- Review rows say who reviews, in what mode, and the round cap.
- The lead is never a row. The lead plans, reviews, verifies, and commits.
