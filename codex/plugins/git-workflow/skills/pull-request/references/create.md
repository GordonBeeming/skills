# Reference: create the draft PR

The lead runs this when the routed scenario is "no PR yet for this work". Output: a draft PR with Copilot's review requested, ready for the teammate to start draft-phase iterations.

## 1. Verify state

```bash
but status -fv
```

Confirm there are uncommitted changes or unpushed commits worth a PR. If there's nothing to commit and no PR-worthy state, ask User what he wants instead of proceeding on an empty branch.

Run the standard repo-entry checks if this session hasn't yet: `shunt-dev active` (siding question if it's a shunt app), then sync through the repo's git route (`but clean --pull` only for GitButler-managed repos).

When working from a shunt siding branch (`gb/shunt/*`), check for stowaway commits before creating the PR: `git log --oneline origin/main..gb/shunt/<name>` must list only that siding's commits. Use the shunt rebase recipe if unrelated workspace commits rode along.

## 2. Commit

Follow the GitButler skill conventions:

1. Use IDs from `but status -fv`.
2. Draft a commit message matching the project's existing style (`git log` for tone). No co-author trailers.
3. On a new piece of work, create the branch first: `but branch new gb/<descriptive-name>` (the `gb/` prefix is required).
4. `but commit <branch> -m "<msg>" --changes <ids> --status-after`
5. Multiple logical changes staged → multiple commits, not one giant one.

On personal-tier repos, confirm the commit is signed (`gpgsig` present; GitHub shows verified after push). Never disable signing to get a commit through.

## 3. Create the draft PR

**The PR template is authoritative. Always use it if it's there.** Check for a repo PR template (`.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/*.md`, `docs/pull_request_template.md`). If one exists, it is the base: keep every section in its original order and fill each one in. Never drop, reorder, or swap a template section for your own, and never replace the template wholesale with a `## Summary` / `## Test plan` body. Append any extra headers or sections after the full template content, not between its sections.

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

**The review set is Copilot and Codex, and both get an explicit request on every head.** Copilot via the REST POST above; Codex via an `@codex review` comment per `autopilot-loop.md` step 6 (CodeRabbit too, but only where it's actually wired up). Neither costs Actions minutes. A round isn't complete until both have responded to the current head, and asking only the one that looks behind is the failure mode this rule exists to stop.

**Never request Claude, and never nudge `@claude`.** The Claude reviewer runs as a GitHub Actions workflow, so every request bills User's Actions minutes — that's why it's out of the set. If a repo auto-runs `claude-code-review.yml`, read the result as free information, but never trigger it and never treat its silence as blocking.

**Gemini (`gemini-code-assist[bot]`) is retired — never request it.** It appears in older PRs' review history, so bot-set discovery by sampling will surface it; ignore it when it does. Its output and its silence are both non-blocking.

## 5. Surface merge-policy dependencies early

Read the base ruleset before handoff:

```bash
gh api repos/<owner>/<repo>/rules/branches/<base> \
  --jq '.[] | select(.type=="pull_request") | .parameters
        | {required_approving_review_count, require_code_owner_review, require_last_push_approval, required_review_thread_resolution, allowed_merge_methods}'
```

If a non-author/code-owner approval is required, tell User at the start and identify the applicable CODEOWNERS. Explain that `require_last_push_approval` invalidates an approval after any later push. If squash is unavailable, use the one-time User decision in SKILL.md.

## 6. Hand off

Return to SKILL.md's "Spawn the teammate" step with: PR URL and number, repo tier, branch name, and a one-paragraph change summary the teammate can use for informed review replies.
