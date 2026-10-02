# Profile schema (v1)

File: `$CLAUDE_CONFIG_DIR/profiles/<org>.json` overlays `profiles/default.json`. `<org>` is the owner
of `git remote get-url origin` (`github.com/<org>/<repo>`, https or ssh form), lowercase. No remote or
no git means default only. Unknown keys are an error: the resolver prints the key and exits 2.

Resolver: `${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh [--dir <repo>] [--get <dotted.key>]` prints the
merged JSON, or one value with `--get`.

```json
{
  "plan":   { "postToIssue": false, "requireIssue": false },
  "review": { "postComments": "never", "approve": "never" },
  "pr":     { "draft": true, "botReview": ["copilot"], "coAuthorTrailer": true, "autoMerge": false, "closingComment": "ask" },
  "git":    { "system": "git", "branchPrefix": "gb/", "signCommits": true },
  "test":   { "command": "", "e2e": "none" },
  "azure":  { "default": "", "environments": {}, "prodGuard": "" },
  "env":    { "lock": "", "launch": [], "teardown": [], "teardownTimeout": "60s", "portOffsetPerWorktree": false },
  "scope":  { "never": [], "askFirst": [] },
  "evidence": { "driver": "claude", "viewports": ["1920x1080","390x844"], "devLogin": false, "loginDriver": "claude" },
  "wt":     { "pruneDays": 7 }
}
```

Enums: `review.postComments` and `review.approve` are `never`, `ask`, or `always`. `git.system` is
`git` only. `test.e2e` is `none` or `scratch-only`.

## Keys

- `plan.postToIssue`: after the plan is approved or logged, post it as a comment on the source issue.
- `plan.requireIssue`: /work refuses to start without an issue and asks for one in step 2.
- `review.postComments`: whether /review may offer to post a review at all (`never` removes the question; nothing is ever posted without User choosing it in step 7).
- `review.approve`: whether `approve` is offered as the review event.
- `pr.draft`: ignored; every PR starts as a draft and is made ready only after the bot rounds. Kept so old profiles still validate. Was: open the PR as a draft so bot rounds happen before it is published.
- `pr.botReview`: the reviewers to request on every head: `copilot`, `codex`, `coderabbit`.
- `pr.coAuthorTrailer`: allow a `Co-Authored-By` line for a human co-author User names. AI or agent attribution is never added, whatever this says.
- `pr.autoMerge`: after the bot rounds are clean, arm auto-merge or press the merge; false leaves the
  merge to User.
- `git.system`: always `git`; plain git on a native worktree.
- `git.branchPrefix`: always `gb/`; a branch is `gb/<category>/<slug>` (categories in the git-usage skill).
- `git.signCommits`: commits must be signed; a signing failure is a stop, never a bypass.
- `test.command`: the test command the lead runs in step 8; empty means use what the repo's CI runs.
- `test.e2e`: `none` means never launch the app; `scratch-only` means launch against scratch data only.
- `azure.default`: the environment name to use when none is stated.
- `azure.environments`: environment name to `{ subscription, tenant }` map for the azure skill.
- `azure.prodGuard`: a glob; any resource name matching it needs an explicit go before a write.
- `env.lock`: the envlock name to acquire before launching the app; empty means no lock.
- `env.launch`: command substrings the PreToolUse hook denies unless this session holds the lock.
- `env.teardown`: commands envlock runs on handover to another worktree before granting the lock.
- `env.teardownTimeout`: how long a teardown command may take before the acquire fails.
- `env.portOffsetPerWorktree`: the app reads its ports from env, so each worktree gets an offset and
  skips the lock.
- `scope.never`: path globs no /work teammate or lead edit may touch.
- `scope.askFirst`: path globs whose edits are called out as an open question at the plan gate.
- `wt.pruneDays`: age after which a clean, unmerged Codex worktree is removed by the prune routine.
- `evidence.driver`: who drives a demo take or evidence capture: `claude` (default; this session, with the `playwright-demo` MCP browser) or `codex` (the take is briefed and run through `take-run.sh`).
- `evidence.viewports`: window sizes to capture, `WxH`, in order.
- `pr.closingComment`: what happens to the closing comment on linked issues at merge time. `ask` (default) asks once; `auto` posts on merge without asking; `review` always shows the draft in plan mode first; `skip` never posts. A `--closing` flag on the command overrides the profile.
- `evidence.devLogin`: true means the repo's seeded dev credentials (documented in its navigate-* skill, CLAUDE.local.md, or README) are test data and the driver types them itself to reach a screen. false means stop and ask User for credentials, then continue; never ask him to sign in for you.
