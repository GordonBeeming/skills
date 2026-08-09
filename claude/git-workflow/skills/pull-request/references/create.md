# Reference: create the draft PR

The lead runs this when the routed scenario is "no PR yet for this work". Output: a draft PR with Copilot's review requested, ready for the teammate to start draft-phase iterations.

## 0. Resolve the git system first — the `but` commands below are the GitButler case only

**Resolve which git system the repo uses before step 1**, and translate every `but` command in this reference to
whichever system it names. A repo carrying no `.git/gitbutler` marker is **plain git**, and `but` will not work
there at all:

| This reference says | GitButler (branch `gitbutler/workspace`) | Plain git | Shunt siding |
| --- | --- | --- | --- |
| verify state | `but status -fv` | `git status --short` + `git log` | `git status` in the worktree |
| sync with main | `but clean --pull` | `git pull --ff-only` on the default branch | per the `shunt` skill |
| new branch | `but branch new gb/<name>` | `git checkout -b gb/<name>` | already on `gb/shunt/<name>` |
| commit | `but commit <branch> -m … --changes <ids>` | `git add <paths>` + `git commit -m …` | `shunt git commit …` |
| open the PR | `but pr new <branch> --draft -F <file>` | `gh pr create --draft --base <base> --head <branch> --title "<line 1>" --body-file <rest>` | `shunt git push` then `gh pr create` |

On plain git the body file's first line is **not** consumed as the title the way `but pr new` does it — split it
yourself (`head -1` for `--title`, `tail -n +3` for `--body-file`) or `gh` will put the title line in the body.
Do the split with absolute paths from the repo root; `cd`-ing into the scratchpad to run `head`/`tail` and then
calling `gh pr create` in the same command fails with `not a git repository`, because `gh` resolves the repo
from cwd.

The `gb/` branch prefix is worth keeping even on plain-git repos where nothing enforces it — User's repos use
it consistently, so matching it keeps branch listings uniform. Check `gh pr list --state merged --json headRefName`
if unsure what a given repo does.

## 1. Verify state

```bash
but status -fv
```

Confirm there are uncommitted changes or unpushed commits worth a PR. If there's nothing to commit and no PR-worthy state, ask User what he wants instead of proceeding on an empty branch.

Run the standard repo-entry checks if this session hasn't yet: `shunt-dev active` (siding question if it's a shunt app) and `but clean --pull`.

**On plain git, also check which branch you're on before committing** — if it's the default branch, branch first
(`git checkout -b gb/<name>`). The GitButler flow never has this problem because work always sits on a virtual
branch off `gitbutler/workspace`; plain git will happily let you commit straight onto `main`.

**Working from a shunt siding branch (`gb/shunt/*`)?** Before creating the PR, check for stowaway commits:
`git log --oneline origin/main..gb/shunt/<name>` must list only this siding's own commits.
The siding branch is cut from the GitButler workspace snapshot, so other applied branches' commits (and
the local-only workspace integration commit) ride along until the branch is rebased
`--onto origin/main`.

## 2. Commit

Follow the GitButler skill conventions:

1. Use IDs from `but status -fv`.
2. Draft a commit message matching the project's existing style (`git log` for tone). No co-author trailers.
3. On a new piece of work, create the branch first: `but branch new gb/<descriptive-name>` (the `gb/` prefix is required).
4. `but commit <branch> -m "<msg>" --changes <ids> --status-after`
5. Multiple logical changes staged → multiple commits, not one giant one.

On personal-tier repos, confirm the commit is signed (`gpgsig` present; GitHub shows verified after push). Never disable signing to get a commit through.

## 3. Create the draft PR

**The PR template is authoritative — always use it if it's there.** Check for a repo PR template (`.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/*.md`, `docs/pull_request_template.md`). If one exists, it is the base: keep every section in its original order and fill each one in. Never drop, reorder, or swap a template section for your own, and never replace the template wholesale with a `## Summary` / `## Test plan` body. Any extra headers or sections you want to add go **after** the full template content, appended at the end — never interleaved with the template's own sections.

**Fill the template in as User, the PR author — never from the agent's perspective.** Write author-facing answers in first person (`I` / `we` as appropriate), not as narration about User, the conversation, or what the agent did. Use repository, issue, plan, and session evidence for factual answers. If any field needs motivation, approval history, business context, or another answer that is not actually known, ask User and wait before creating or updating the PR; never invent it, expose agent/process narration, or turn the missing answer into wording such as “Conversation with User...” or “User reviewed...”.

Write the body to a file (scratchpad or `.git/`): **line 1 is the title** (under ~70 chars, repo's title style), blank line, then the body. With a template, the body is the filled-in template, followed by any extra sections you're appending (e.g. `Closes #<issue>` for a linked issue). With **no** template, author the body yourself: `## Summary`, `## Test plan`, and `Closes #<issue>` when there's a linked issue. Run the humanizer pass on the body — it's human-facing prose.

```bash
but pr new <branch> --draft -F <body-file>
```

Do not pass `-t` — in the current GitButler CLI `-t` means `--default`, not title. Capture the PR URL from the output. Pair-programming fields (if the repo template has one) list humans only.

Run `but clean --pull` after the push.

## 4. Request Copilot review on the draft

```bash
gh api -X POST repos/<owner>/<repo>/pulls/<n>/requested_reviewers \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

This REST POST is the working form — its response echoes `Copilot` in `requested_reviewers`. The `gh pr edit <n> --add-reviewer Copilot` fallback does NOT work for this bot (fails `Could not resolve user with login 'copilot'`); prefer the REST POST.

Copilot hard-caps at **300 changed files**: past that it posts an explicit "wasn't able to review" comment instead of a review. That decline counts as "responded to the current head" for gate purposes — it's a stated answer, not silence — and re-requesting won't change it, so don't burn ticks re-asking. Other configured bots don't share the cap and can still give content review.

**`reviewRequests` reading empty right after a successful POST is normal, not a failure** — Copilot consumes the request almost immediately as it queues its review, so `gh pr view <n> --json reviewRequests` can show `[]` seconds later even though the POST returned `Copilot`. Don't loop re-requesting on the lead side; the teammate's loop re-requests only if Copilot hasn't responded to the current head SHA. Confirm the POST itself succeeded (its `--jq '.requested_reviewers[].login'` prints `Copilot`) and hand off.

**The review set is Copilot and Codex, and both get an explicit request on every head.** Copilot via the REST POST above; Codex via an `@codex review` comment per `autopilot-loop.md` step 6. Neither costs Actions minutes — Copilot is a first-party reviewer and `chatgpt-codex-connector[bot]` is a hosted GitHub App. A round isn't complete until both have responded to the current head, and asking only the one that looks behind is the failure mode this rule exists to stop.

**Never request Claude, and never nudge `@claude`.** The Claude reviewer runs as a GitHub Actions workflow, so every request bills User's Actions minutes — that's the whole reason it's out. A repo may still run `claude-code-review.yml` on its own; if it does, read the result as free information, but never trigger it and never treat its silence as blocking.

**Gemini (`gemini-code-assist[bot]`) is retired — never request it.** It appears in the review history of older PRs on some repos, so bot-set discovery by sampling will surface it; ignore it when it does. Its output and its silence are both non-blocking, and it never counts as a pending bot in any gate.

CodeRabbit is repo-conditional: request it only where it's actually wired up. Verify by sampling recent PRs (`gh api repos/<o>/<r>/pulls/<recent-n>/reviews` / `.../comments` per bot login) and/or `.github/` config — a login with zero historical activity and no wiring is **not configured**, so nudging it wastes a request cap and its silence must be treated as non-blocking. Persist the repo's real configured-bot set to project memory so later runs skip the check.

## 5. Check the merge gate — surface human-approval needs at the START, not at merge time

Read the base branch's ruleset once, at creation, so any human dependency is known up front instead of discovered when everything else is green:

```bash
gh api repos/<owner>/<repo>/rules/branches/<base> \
  --jq '.[] | select(.type=="pull_request") | .parameters
        | {required_approving_review_count, require_code_owner_review, require_last_push_approval, required_review_thread_resolution, allowed_merge_methods}'
```

If `required_approving_review_count >= 1` (especially with `require_code_owner_review` and/or `require_last_push_approval`), the PR **cannot merge on bot reviews alone** — Copilot and Codex only *comment*, never *approve*, and User can't approve his own PR. Tell User at handoff that a **non-User code-owner must approve the final head**, so he lines that reviewer up in parallel instead of being blocked at the end. Identify the code owners for the changed paths (`.github/CODEOWNERS`) so the ask is specific.

With `require_last_push_approval: true`, an approval given before a later push goes **stale** and must be re-issued on the final commit — so once review rounds start moving the head, every new push invalidates a prior approval, and the PR sits on `REVIEW_REQUIRED` even when a reviewer already approved an earlier head. Flag this explicitly: the code-owner approval has to land on whatever ends up being the last commit, so it's usually the very last step.

If `allowed_merge_methods` lacks `squash`, that's the one-User-question-persist-to-memory case from SKILL.md.

## 6. Hand off

Return to SKILL.md's "Spawn the teammate" step with: PR URL and number, repo tier, branch name, and a one-paragraph change summary the teammate can use for informed review replies. Also state that Copilot's review was already requested at creation — `reviewRequests` reads empty almost immediately (see above), so without being told, the teammate's first tick re-requests it and burns one of its capped requests on a duplicate.
