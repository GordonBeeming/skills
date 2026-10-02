---
name: envlock
description: Environment lock for shared dev resources (ports, database, containers) that a worktree can't isolate on its own. Use before starting a dev server, Aspire host, or anything the profile's env.launch patterns match, and when a launch is denied with "run: envlock acquire".
---

# envlock

Worktrees isolate code, not the dev database or fixed ports. `envlock` is the one-holder lock that
keeps two worktrees, on either harness, from fighting over the same environment. Claude enforces it
automatically with a `PreToolUse` hook; Codex has no equivalent hook here, so `$work` calls
`envlock acquire` and `envlock release` explicitly around any launch, and this skill is that
explicit call, not a background guard.

## Commands

```
"${PLUGIN_ROOT}/scripts/envlock.sh" acquire <name> [--wait <dur>] [--worktree <path>] [--session <id>]
"${PLUGIN_ROOT}/scripts/envlock.sh" release <name> [--session <id>]
"${PLUGIN_ROOT}/scripts/envlock.sh" status  [<name>] [--json]
"${PLUGIN_ROOT}/scripts/envlock.sh" steal   <name> [--worktree <path>] [--session <id>]
```

`<name>` is a profile's `env.lock` value (e.g. `myapp`). `<dur>` is seconds, or a number with an
`s`/`m`/`h` suffix (`5m`, `60s`, `1h`). `--wait` blocks and polls every 5 seconds until the lock frees
or the duration runs out. The lock is machine-wide and harness-agnostic: a Claude session and a Codex
session contend for the same lock file, so whichever launched first blocks the other regardless of
which CLI it's running.

## How $work uses it

1. Before running anything that matches the profile's `env.launch` patterns (e.g. `aspire run`,
   `dotnet run`), `$work` calls `envlock.sh acquire <name> --wait`.
2. On acquire, if the new worktree differs from whoever held the lock last, the profile's
   `env.teardown` commands run first (stop containers, free the port/volume). Same worktree as last
   time skips teardown, so a warm database stays warm. A teardown failure aborts the acquire; no lock
   is taken and nothing gets torn down halfway.
3. `$work` releases the lock once its verification step ends, so a long build never blocks a queued
   run for longer than it has to.
4. Nothing here auto-denies a launch command the way Claude's hook does, `$work` and this skill are
   the enforcement. Run `envlock.sh status <name>` before any launch you're not sure is covered, and
   don't run the launch command until `acquire` has returned.

## Manual use

- `envlock.sh status` lists every lock this machine has a record of, free or held.
- If a session died without releasing (crash, force-quit), its lock looks held but the owner's PID is
  gone. The next `acquire` detects that automatically and treats it as free, no manual step needed.
- `envlock.sh steal <name>` takes a lock over unconditionally, running teardown first. Use it only
  when you're sure the previous holder is actually gone; it doesn't check aliveness the way `acquire`
  does.

## Where the state lives

Locks are files under `~/.claude/locks/<name>/`, the script hardcodes this path (via
`$CLAUDE_CONFIG_DIR`, falling back to `~/.claude`) on purpose, so a lock taken from a Codex session
and a lock taken from a Claude session are the same lock. `owner.json` while held,
`<name>.last.json` after release (used for the handover teardown decision on the next acquire).
Nothing here is git-tracked or backed up; it's purely runtime state for the current machine.
