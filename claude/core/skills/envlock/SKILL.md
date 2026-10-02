---
name: envlock
description: Environment lock for shared dev resources (ports, database, containers) that a worktree can't isolate on its own. Use before starting a dev server, Aspire host, or anything the profile's env.launch patterns match, and when a launch is denied with "run: envlock acquire".
---

# envlock

Worktrees isolate code, not the dev database or fixed ports. `envlock` is the one-holder lock that
keeps two worktrees from fighting over the same environment. A `PreToolUse` hook enforces it on every
`Bash` call automatically, so this is rarely invoked by hand.

## Commands

```
envlock acquire <name> [--wait <dur>] [--worktree <path>] [--session <id>]
envlock release <name> [--session <id>]
envlock status  [<name>] [--json]
envlock steal   <name> [--worktree <path>] [--session <id>]
```

`<name>` is a profile's `env.lock` value (e.g. `myapp`). `<dur>` is seconds, or a number with an
`s`/`m`/`h` suffix (`5m`, `60s`, `1h`). `--wait` blocks and polls every 5 seconds until the lock frees
or the duration runs out.

## How /work uses it

1. Before running anything that matches the profile's `env.launch` patterns (e.g. `aspire run`,
   `dotnet run`), `/work` calls `envlock acquire <name> --wait`.
2. On acquire, if the new worktree differs from whoever held the lock last, the profile's
   `env.teardown` commands run first (stop containers, free the port/volume). Same worktree as last
   time skips teardown, so a warm database stays warm. A teardown failure aborts the acquire; no lock
   is taken and nothing gets torn down halfway.
3. `/work` releases the lock once its verification step ends, so a long build never blocks a queued
   run for longer than it has to.
4. The `PreToolUse` hook denies any Bash command matching `env.launch` unless the calling session
   holds the lock, and names the current holder plus the exact `acquire` command to run instead.
5. The `Stop` hook releases every lock the ending session still holds, so a killed or finished session
   never leaves a stale holder.

## Manual use

- `envlock status` lists every lock this machine has a record of, free or held.
- If a session died without releasing (crash, force-quit), its lock looks held but the owner's PID is
  gone. The next `acquire` detects that automatically and treats it as free, no manual step needed.
- `envlock steal <name>` takes a lock over unconditionally, running teardown first. Use it only when
  you're sure the previous holder is actually gone; it doesn't check aliveness the way `acquire` does.

## Where the state lives

Locks are files under `$CLAUDE_CONFIG_DIR/locks/<name>/` (or `~/.claude/locks/<name>/` once that's the
live config dir): `owner.json` while held, `<name>.last.json` after release (used for the handover
teardown decision on the next acquire). Nothing here is git-tracked or backed up; it's purely runtime
state for the current machine.
