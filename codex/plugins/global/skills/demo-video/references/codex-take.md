# Codex browser take

Claude will not type a password into a login field, in any browser, by any route. That is a model
boundary, not a setting. Codex has no such boundary and has the same interactive Playwright MCP tools.
So any take that needs a login is driven by Codex, interactively, with Claude keeping the storyboard,
the QA pass, and the assembly.

## When

Always. Every demo take, login or not.

## How

1. Write the take brief to `<run dir>/take-<n>.md` from the template below: the app URL, the seeded
   credentials by reference (the file and constant name, never the value), the window size, the exact
   click path, the lower-third text per section, the callout targets, and the output file.
2. Run it:
   ```
   <core plugin>/scripts/codex-run.sh --mode build --model gpt-6-astra --repo <repo> \
     --prompt <run dir>/take-<n>.md --out <run dir>/take-<n>.json --timeout 20m
   ```
   Build mode answers tool approvals itself (`--approve-for-me`, still sandboxed to workspace-write)
   and may write only inside the repo, the `--out` directory, and each `--writable` dir, so the MP4
   path in the brief must sit in one of those. Codex drives its Playwright MCP browser one tool call
   per action (headed, so the window can be recorded), logs in with the seeded credentials it reads
   from the repo, injects the overlays, starts and stops `screen-record.sh`, and writes the MP4.
3. Read `take-<n>.json`: the response names the MP4 and any beat it could not perform. Frame-sample QA
   the MP4 exactly as for a Claude-driven take; a missing beat means a second run with a narrower brief
   via `--resume <threadId>`, not a script.

## Take brief template

```text
GUI automation authorised by User: control, resize, and record the browser window named below without asking.
You are driving a demo take in a browser with your `playwright-demo` MCP tools (the demo profile: its own user data dir, 1920x1080 window, self-signed certs accepted), one action per tool call. Do not use the plain `playwright` server for this. No scripts.
App: <url>. Window: 1920x1080 (the demo profile already opens at that size; confirm with a resize if not).
Login: user <name>; the password is the constant <Name> in <repo-relative path>; read it from the file and type it. Do this BEFORE recording starts.
Record with: <demo-video skill dir>/scripts/screen-record.sh start <out.mp4> --app "Chromium"   (stop with: screen-record.sh stop <out.mp4>)
Overlays: before each section run this in the page: <setStep snippet with the section text>; before each highlighted element run: <callout snippet>.
Beats, in order:
  1. <click path + what must be visible>
  2. ...
Pace: pause about a second after each action. Never show the login form on camera.
When done, reply with one line per beat: done, or what stopped it, then the MP4 path.
```
