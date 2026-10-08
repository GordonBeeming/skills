---
name: cross-agent
description: Decide when a /work or /review teammate row should be Codex or Antigravity instead of Claude, and how to call codex-run.sh / agy-run.sh and read their report files. Use whenever /work or /review composes a team that includes a codex or agy worker, or a task explicitly asks to run something in Codex or Antigravity. Not a standalone user-facing workflow; the runner scripts are the mechanics, this skill is the routing and report-shape reference.
---

# cross-agent

## When to reach for which

- **Claude** (team or agent teammate): default for anything needing this session's tools, MCP servers, or judgement calls mid-run.
- **Codex** (`codex-run.sh`): a second opinion on a Claude-built diff, or a self-contained build track with a clear spec that benefits from a different model's blind spots.
- **Antigravity** (`agy-run.sh`): a cheap parallel track (`gemini-3.8-flash-low`) or a Gemini/Claude-model review pass. Headless only, no interactive escalation.

A diff one agent builds gets reviewed by a different one: Codex builds, Claude or Antigravity reviews; Claude builds, Codex or Antigravity reviews. An agent never reviews its own build.

## Runner contracts

Both scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts/`, take the same required flags, and always write a JSON report plus a raw-output sibling file.

```
codex-run.sh --mode <review|build> --model <model> --repo <dir> --prompt <file> --out <report.json> [--resume <thread-id>] [--timeout <duration>]
agy-run.sh   --mode <review|build> --model <model> --repo <dir> --prompt <file> --out <report.json> [--resume <conversation-id>] [--timeout <duration>]
```

- `--mode review` is read-only/sandboxed. `--mode build` is workspace-write, still headless-approved, never an interactive escalation. Use `review` for anything that only reads and reports; `build` only when the task is authorized to write in `--repo`.
- Model is always explicit on the command line, never left to a config default.
- `--timeout` defaults to 10m; both scripts kill the run and report `status: "timeout"` if it runs over.
- Exit code is 0 only when `status` is `"completed"`, non-zero on `failed` or `timeout`, so a caller can branch on the exit code alone without parsing JSON first.
- `--repo` is required on every call, resume included: `codex exec resume` has no `-C` flag, so `codex-run.sh` runs the resume from inside `--repo`.

## Report shape

`codex-run.sh` writes `<out>` and `<out>.jsonl` (the raw Codex event stream):

```json
{ "tool": "codex", "mode": "review", "model": "gpt-6.1-sol", "sandbox": "read-only", "repo": "...",
  "threadId": "...", "status": "completed|failed|timeout", "response": "...", "exitCode": "0",
  "startedAt": "...", "endedAt": "...", "eventsFile": "...", "stderrTail": "" }
```

`agy-run.sh` writes `<out>` and `<out>.raw.json` (agy's unmodified `--output-format json` payload):

```json
{ "tool": "agy", "mode": "review", "model": "gemini-3.1-pro-low", "repo": "...",
  "conversationId": "...", "status": "completed|failed|timeout", "agyStatus": "SUCCESS",
  "response": "...", "deniedActions": [], "exitCode": "0", "startedAt": "...", "endedAt": "...",
  "rawFile": "...", "stderrTail": "" }
```

`threadId` / `conversationId` is the resume handle: pass it back as `--resume` on the next call to keep the same worker in context across `/work` waves or `/review` rounds.

## Calling from /work or /review

A teammate row with `kind: codex` or `kind: agy` in `run.json`'s `workers.composition` maps to one of these scripts: the lead writes the prompt to a file, calls the runner, reads the report, and stores `threadId`/`conversationId` on that row for the next call. A `failed` or `timeout` report is treated the same as a failed teammate: it's surfaced in the done report, never retried silently.

## Models

Codex accepts any id from `codex models` or the profile. **The target is `gpt-6.1-sol` for all
work; `gpt-6-luna` for a row that is pure coding to a spec; `gpt-6-astra` when the run chose it.**
The run's choice lives in `run.json.workers.codexModel` (step 0 asks it). Always the latest id in
each family. The strong model plans and reviews; a cheaper one builds only when the spec pins the
work down, and a thin spec is a spec problem, not a model problem.
