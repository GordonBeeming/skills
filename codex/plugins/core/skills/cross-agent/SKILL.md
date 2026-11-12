---
name: cross-agent
description: Route $work and $review reviewer rows to Claude, Antigravity or Grok (other models review, Codex builds), and how to call claude-run.sh / agy-run.sh / grok-run.sh and read their report files. Use whenever $work or $review composes a team that includes a claude, agy or grok reviewer, or a task explicitly asks to run something in Claude, Antigravity or Grok. Not a standalone user-facing workflow; the runner scripts are the mechanics, this skill is the routing and report-shape reference.
---

# cross-agent

## Who builds, who reviews

Codex builds. Every other model reviews. From this side, Claude, Antigravity and Grok are reviewers,
never workers: their value is a different model's blind spots on a diff Codex wrote, and a second
builder only adds a diff nobody in this session has read.

- **Codex** (`spawn_agent` / `send_message`): every build, test and fix row.
- **Claude** (`claude-run.sh --mode review`): an independent review pass, `sonnet` by default.
- **Antigravity** (`agy-run.sh --mode review`): a Gemini review pass on `gemini-4-argon-medium`.
- **Grok** (`grok-run.sh --mode review`): an xAI review pass on `grok-4.7`. Review is its only mode.

A foreign `--mode build` run happens only when User asks for one in words for that task (the
`$work` design hand-off to Claude is one he answers in the menu). Headless only everywhere, no
interactive escalation. An agent never reviews its own build.

## Runner contracts

All three live in `${PLUGIN_ROOT}/scripts/`, take the same required flags, and always write a JSON
report plus a raw-output sibling file.

```
claude-run.sh --mode <review|build> --model <model> --repo <dir> --prompt <file> --out <report.json> [--resume <session-id>] [--timeout <duration>]
agy-run.sh    --mode <review|build> --model <model> --repo <dir> --prompt <file> --out <report.json> [--resume <conversation-id>] [--timeout <duration>]
grok-run.sh   --mode review         --model <model> --repo <dir> --prompt <file> --out <report.json> [--resume <session-id>] [--timeout <duration>]
```

- `--mode review` is read-only in effect, and it's the mode every reviewer row uses. `grok-run.sh`
  runs `--permission-mode plan` (no sandbox: Grok's read-only profile won't start with OrbStack's
  docker.sock link) and refuses `--mode build` with exit 2. The review brief forbids git network commands.
- `--mode build` (claude and agy only) is write-enabled, still headless-approved, never an
  interactive escalation, and only for a build User asked for in words.
- `claude-run.sh`'s `--mode review` runs `--permission-mode plan`; `--mode build` runs
  `--permission-mode acceptEdits`. It never passes `bypassPermissions`, the Claude-side analogue of
  `--yolo`, and just as off-limits from this script.
- Model is always explicit on the command line, never left to a config default.
- `--timeout` defaults to none. Pass one only when User gave the run a time cap; then the script
  kills the run past it and reports `status: "timeout"`.
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
{ "tool": "agy", "mode": "review", "model": "gemini-4-argon-medium", "repo": "...",
  "conversationId": "...", "status": "completed|failed|timeout", "agyStatus": "SUCCESS",
  "response": "...", "deniedActions": [], "exitCode": "0", "startedAt": "...", "endedAt": "...",
  "rawFile": "...", "stderrTail": "" }
```

`grok-run.sh` writes `<out>` and `<out>.raw.json` (grok's unmodified `--output-format json` payload):

```json
{ "tool": "grok", "mode": "review", "model": "grok-4.7", "permissionMode": "plan", "sandbox": "none",
  "repo": "...", "sessionId": "...", "status": "completed|failed|timeout", "stopReason": "end_turn",
  "response": "...", "error": "", "exitCode": "0", "startedAt": "...", "endedAt": "...",
  "rawFile": "...", "stderrTail": "" }
```

`grok-run.sh` picks the session id before the run, so `sessionId` is set even on a failure.

`sessionId` / `conversationId` is the resume handle: pass it back as `--resume` on the next call to
keep the same worker in context across `$work` waves or `$review` rounds.

## Calling from $work or $review

A review row with `kind: claude`, `kind: agy` or `kind: grok` in `run.json`'s `workers.composition`
maps to one of these scripts: the lead writes the prompt to a file, calls the runner, reads the report, and
stores `sessionId`/`conversationId` on that row for the next call. A `failed` or `timeout` report is
treated the same as a failed teammate: it's surfaced in the done report, never retried silently, except a quota error below.

**Quota never blocks.** A report whose error says the account is out (quota, usage limit, rate limit, credits, billing, HTTP 429) is not a failure to work: swap that row to the next reviewer that isn't the builder and isn't already reviewing this diff, in the order Claude, Grok, Antigravity, and run it straight away. Never ask User which one to use and never wait for the quota to reset. Record the swap on the row (`swapped: agy -> claude (quota)`) and in the done report. When every other model is out, the run carries on without that review and the done report says so in one line; it never stops on it.

Native Codex rows go through `spawn_agent` / `send_message` instead of a runner script. If
`spawn_agent`'s schema doesn't expose a model field, use the normal teammate default and record that
limitation in the row's notes rather than inventing an unsupported argument or silently claiming the
requested model ran.

## Models

Claude accepts any id the `claude-run.sh` caller names, e.g. `sonnet` or `opus`; `sonnet` is the
default for a review pass unless the task calls for `opus`. Grok runs `grok-4.7`; `grok models` lists
what the account can reach. Antigravity, from `agy models`:
`gemini-4-argon-{low,medium,high}`, `gemini-3.8-flash-{low,medium,high}`, `claude-opus-5-5-{low,medium,high}`,
`claude-sonnet-5-5-{low,medium,high}`, `gpt-oss-120b-medium`. Default for a review is
`gemini-4-argon-medium`.
