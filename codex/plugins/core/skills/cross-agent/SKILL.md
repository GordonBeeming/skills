---
name: cross-agent
description: Decide when a $work or $review teammate row should be Claude or Antigravity instead of native Codex, and how to call claude-run.sh / agy-run.sh and read their report files. Use whenever $work or $review composes a team that includes a claude or agy worker, or a task explicitly asks to run something in Claude or Antigravity. Not a standalone user-facing workflow; the runner scripts are the mechanics, this skill is the routing and report-shape reference.
---

# cross-agent

## When to reach for which

- **Codex** (`spawn_agent` / `send_message`): default for anything needing this session's tools, MCP
  servers, or judgement calls mid-run.
- **Claude** (`claude-run.sh`): a second opinion on a Codex-built diff, or a self-contained build
  track with a clear spec that benefits from a different model's blind spots.
- **Antigravity** (`agy-run.sh`): a cheap parallel track (`gemini-3.8-flash-low`) or a Gemini/Claude-
  model review pass. Headless only, no interactive escalation.

A diff one agent builds gets reviewed by a different one: Claude builds, Codex or Antigravity
reviews; Codex builds, Claude or Antigravity reviews. An agent never reviews its own build.

## Runner contracts

Both scripts live in `${PLUGIN_ROOT}/scripts/`, take the same required flags, and always write a
JSON report plus a raw-output sibling file.

```
claude-run.sh --mode <review|build> --model <model> --repo <dir> --prompt <file> --out <report.json> [--resume <session-id>] [--timeout <duration>]
agy-run.sh    --mode <review|build> --model <model> --repo <dir> --prompt <file> --out <report.json> [--resume <conversation-id>] [--timeout <duration>]
```

- `--mode review` is read-only in effect. `--mode build` is write-enabled, still headless-approved,
  never an interactive escalation. Use `review` for anything that only reads and reports; `build`
  only when the task is authorized to write in `--repo`.
- `claude-run.sh`'s `--mode review` runs `--permission-mode plan`; `--mode build` runs
  `--permission-mode acceptEdits`. It never passes `bypassPermissions`, the Claude-side analogue of
  `--yolo`, and just as off-limits from this script.
- Model is always explicit on the command line, never left to a config default.
- `--timeout` defaults to 10m; both scripts kill the run and report `status: "timeout"` if it runs
  over.
- Exit code is 0 only when `status` is `"completed"`, non-zero on `failed` or `timeout`, so a caller
  can branch on the exit code alone without parsing JSON first.
- `--repo` is required on every call, resume included: neither `claude` nor `agy` takes a `-C`-style
  flag, so both scripts `cd`/`--add-dir` into `--repo` themselves.

## Report shape

`claude-run.sh` writes `<out>` and `<out>.json` (claude's unmodified `--output-format json` payload):

```json
{ "tool": "claude", "mode": "review", "model": "sonnet", "permissionMode": "plan", "repo": "...",
  "sessionId": "...", "status": "completed|failed|timeout", "response": "...", "exitCode": "0",
  "startedAt": "...", "endedAt": "...", "rawFile": "...", "stderrTail": "" }
```

`agy-run.sh` writes `<out>` and `<out>.raw.json` (agy's unmodified `--output-format json` payload):

```json
{ "tool": "agy", "mode": "review", "model": "gemini-3.1-pro-low", "repo": "...",
  "conversationId": "...", "status": "completed|failed|timeout", "agyStatus": "SUCCESS",
  "response": "...", "deniedActions": [], "exitCode": "0", "startedAt": "...", "endedAt": "...",
  "rawFile": "...", "stderrTail": "" }
```

`sessionId` / `conversationId` is the resume handle: pass it back as `--resume` on the next call to
keep the same worker in context across `$work` waves or `$review` rounds.

## Calling from $work or $review

A teammate row with `kind: claude` or `kind: agy` in `run.json`'s `workers.composition` maps to one
of these scripts: the lead writes the prompt to a file, calls the runner, reads the report, and
stores `sessionId`/`conversationId` on that row for the next call. A `failed` or `timeout` report is
treated the same as a failed teammate: it's surfaced in the done report, never retried silently.

Native Codex rows go through `spawn_agent` / `send_message` instead of a runner script. If
`spawn_agent`'s schema doesn't expose a model field, use the normal teammate default and record that
limitation in the row's notes rather than inventing an unsupported argument or silently claiming the
requested model ran.

## Models

Claude accepts any id the `claude-run.sh` caller names, e.g. `sonnet` or `opus`; `sonnet` is the
default for a build row and for a review pass unless the task calls for `opus`. On the Codex side the
same split applies when Claude drives Codex: build rows run `gpt-5.6-luna`, review rows `gpt-6-astra`.
The strong model plans and reviews, the cheap one builds to a spec that already pins the work down. Antigravity, from `agy models`:
`gemini-3.8-flash-{low,medium,high}`, `gemini-3.1-pro-{low,high}`, `claude-sonnet-4-6`,
`claude-opus-4-6-thinking`, `gpt-oss-120b-medium`. Default review model is `gemini-3.1-pro-low`;
default cheap build track is `gemini-3.8-flash-low`.
