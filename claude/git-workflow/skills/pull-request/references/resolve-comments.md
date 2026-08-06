# Reference: resolve review comments

Act as a developer addressing code review feedback. Given a pull request, fetch all open (unresolved) review comments and check-run annotations, fix each issue in the code, commit and push the changes, then reply to and resolve each thread on GitHub. Flag ambiguous or questionable comments through the decision gates below.

This reference is part of the `pull-request` skill. It runs in one of two modes:

- **Direct mode** — the main session runs it itself (User asked for a one-off resolve round). Decision gates go straight to User via `EnterPlanMode` / `AskUserQuestion`, exactly as written in each step.
- **Delegated mode** — a teammate runs it inside an autopilot loop. The teammate has no channel to User, so every decision gate becomes a `SendMessage` to the lead instead: send the same block content the step specifies (skip-plan template, scope-creep template, re-opened table, question-only table), then wait for the lead's reply before acting. The lead decides what the authority table in SKILL.md allows and forwards the rest to User. Never substitute your own judgment for a gate — if the step says gate, you gate, in both modes.

## Reply sign-off (mandatory on every automated reply)

Every reply this reference posts — fix-done replies, already-done replies, skip-plan replies, auto-skip replies, scope-split replies, clarifying questions — must end with this exact sign-off block as the last line of the comment body:

```text

---
\- Posted autonomously by 🤖 with permission... if you believe this is the incorrect response, please unresolve the comment and it will be flagged
```

The leading blank line and `---` separator are required so the sign-off renders as a clean footer below the reply prose. The dash is escaped (`\-`) so GitHub renders it as a literal dash rather than a single-item bullet list. Do not paraphrase, translate, shorten, or split it across lines, and do not drop the backslash. The literal text after the backslash is the load-bearing signal that Step 2.6 keys off — changing it breaks the re-opened-thread detection in future runs.

When this reference runs on a PR it has touched before, this footer is also the **tell** that a thread was previously resolved by us. See Step 2.6.

## Workflow

### 1. Fetch PR details and open comments

- Extract the owner, repo, and PR number from the provided URL.
- Fetch PR metadata:
  ```bash
  gh pr view <number> --repo <owner>/<repo> --json title,headRefName,baseRefName,url
  ```
- Fetch ALL review comments (not just top-level PR comments):
  ```bash
  gh api repos/<owner>/<repo>/pulls/<number>/comments --paginate
  ```
- Also fetch review threads to identify which are resolved vs unresolved:
  ```bash
  gh api graphql -f query='
    query($owner: String!, $repo: String!, $pr: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              isOutdated
              comments(first: 50) {
                nodes {
                  id
                  databaseId
                  body
                  path
                  line
                  originalLine
                  diffHunk
                  author { login }
                  createdAt
                }
              }
            }
          }
        }
      }
    }
  ' -f owner="<owner>" -f repo="<repo>" -F pr=<number>
  ```
- Filter to only **unresolved** threads (include outdated threads — GitHub still shows them as open and reviewers expect them resolved).

### 1.5. Fetch check-run annotations (SonarCloud, linters, etc.) — mandatory

PRs can have findings that aren't review threads — they're posted as **check-run annotations** that show up in the Files Changed sidebar (the "⚠ N" badge near the comments count). SonarCloud, code-style linters, and security scanners surface findings this way. They block merges via failed quality gates but never appear in the `reviewThreads` GraphQL query, so a thread-only triage misses them entirely.

Always pull them:

```bash
# Get the PR's head SHA, then list each check-run that has annotations.
HEAD=$(gh pr view <number> --repo <owner>/<repo> --json headRefOid --jq .headRefOid)
gh api "repos/<owner>/<repo>/commits/$HEAD/check-runs" \
  --jq '.check_runs[] | select(.output.annotations_count > 0) | {name, id}'
```

For each check-run with annotations, fetch them:

```bash
gh api "repos/<owner>/<repo>/check-runs/<id>/annotations" --paginate \
  --jq '[.[] | {path, line: .start_line, level: .annotation_level, title, message}]'
```

Treat each annotation as a finding to triage in Step 3 alongside the review threads:

- **`failure`** level → Actionable. Block merge until fixed.
- **`warning`** level → Actionable unless clearly noise. Sonar's "Reorder elements / Remove unnecessary cast / Use string interpolation" rules are usually quick fixes worth doing in-PR.
- **`notice`** level → Skip-class; reply on the PR if a reviewer asked about it, otherwise leave alone.

Author classification: every check-run is a bot. The check-run's `name` (e.g. `SonarCloud Code Analysis`, `CodeQL`, `Lint`) is the "reviewer" for audit-trail purposes.

**Why this matters:** SonarCloud's bot leaves *one* PR comment with a quality-gate-failed summary and a link to the dashboard, which is private. Without this step, you'll see "0 unresolved threads", merge happily, and ship code that never had its lint findings looked at. Every Sonar/Lint finding flagged on the PR's commits is something a reviewer expected to be addressed.

After fixing each annotation in Step 4, push the commit — the next check-run cycle will re-evaluate and the annotation drops off automatically. There's no separate "resolve" mutation for check-run annotations; the next clean run is the resolution. Note this in the Step 8 final summary alongside the thread tally.

### 2. Ensure correct branch

In a GitButler-managed repo (the usual case) the workspace already carries the branch — run `but clean --pull` and stay on `gitbutler/workspace`. Outside GitButler:

```bash
git fetch origin <headRefName>
git checkout <headRefName>
```

Pull latest to ensure you're up to date.

### 2.5. Classify reviewer author (per thread)

Before triage, tag each unresolved thread's top commenter as **bot** or **human**. This tag picks the skip flow: bot → Step 3.7 auto-skip (no gate), human → Step 3.6 Skip-plan (always gated). Issue creation (Step 3.5) is gated regardless of author.

- **Bot** — `author.login` matches `copilot`, `copilot-pull-request-reviewer`, `github-copilot[bot]`, `github-actions[bot]`, `coderabbitai[bot]`, `gemini-code-assist`, `sonarcloud[bot]`, `chatgpt-codex-connector`, or any login ending in `[bot]`.
- **Human** — everything else.

Record the tag alongside the thread's other data so Step 3, 3.6, and 3.7 can read it.

### 2.6. Detect re-opened resolutions (mandatory — runs before triage)

A reviewer can un-resolve a thread we previously resolved. The sign-off footer (see "Reply sign-off" above) explicitly tells them to do this when our reply was wrong. A re-opened thread is **never** a fresh comment to triage — it's a human signal that our last call on this thread was incorrect and User needs to look at it himself.

**Detection rule:** for each unresolved thread from Step 1, scan every comment in the thread (any author) for the literal sign-off string:

```text
Posted autonomously by 🤖 with permission
```

If any comment in the thread contains this string, the thread is **re-opened** — bucket it into `reopenedThreads` and remove it from the triage pool. Do not classify it via Step 2.5, do not run it through Steps 3/3.5/3.6/3.7, do not auto-skip, do not reply, do not resolve.

**This gate always ends at User, in both modes and both repo tiers.** In direct mode, surface the table below as the FIRST item in the next `EnterPlanMode` call — even if no other thread requires plan mode this run, open plan mode purely to surface this list. In delegated mode, SendMessage the same table to the lead flagged `re-opened threads — User required`; the lead forwards it to User and nobody touches the threads meanwhile.

Block format (literal — in direct mode paste at the top of the plan, above all other sections; in delegated mode it's the message body):

```markdown
# ⚠️ Re-opened resolutions — these need YOUR decision

The reviewer un-resolved <N> thread(s) that I previously resolved. The sign-off footer asked them to do this if my reply was wrong, so each of these is a signal that my prior call was incorrect. **I will not touch these threads in this run.** You must:

1. Read each thread below.
2. Decide whether to fix, re-reply, or close the thread yourself.
3. Resolve the thread manually once you're happy with the outcome.

| # | File | Line | Reviewer | Original our-reply (quoted) | Their follow-up (if any) | Link |
| - | ---- | ---- | -------- | --------------------------- | ------------------------ | ---- |
| 1 | `<path>` | <n> | @<login> | > <quoted first reply we posted> | > <quoted comment posted after our reply, if any — else "(none — they only re-opened)"> | <thread URL> |
| ...
```

Populate one row per re-opened thread. The "original our-reply" column quotes the first comment in the thread whose body contains the sign-off — that's the reply that prompted them to un-resolve. The "their follow-up" column quotes any comment posted *after* our sign-off reply; if none exists, say `(none — they only re-opened)` so User knows there's no further text to read.

**Audit trail:** record every re-opened thread in the Step 8 final summary too, so the final report shows what was deferred to User.

### 3. Triage comments

Categorize each unresolved comment thread into one of the rows below. The **Bot** and **Human** columns show the default lean — they differ because bots typically don't see the conversation, linked issues, or deliberate design decisions that produced the diff, while humans usually do.

| Category                            | Description                                                                                                                                                                                                                | Bot author                                        | Human author                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| **Actionable**                      | For bots: a concrete bug, security issue, data-loss risk, null/exception risk, or correctness defect. NOT style/consistency/version-alignment/preference. For humans: any clear code change that doesn't contradict intent | Fix it                                            | Fix it                                    |
| **Style / consistency / preference**| Suggests aligning to an existing pattern, version, naming, ordering, or formatting — not flagging a correctness/security/data-loss issue                                                                                   | **Cheap & non-divergent → fix it** (Step 4); auto-skip (Step 3.7) only if it pulls against the PR's chosen direction | Skip-plan (Step 3.6) leaning fix          |
| **Contradicts task intent**         | Comment suggests undoing or weakening something that was the explicit goal of the PR/task                                                                                                                                  | Auto-skip (Step 3.7) — bot likely missing intent  | Skip-plan (Step 3.6) — escalate hard      |
| **Ambiguous**                       | Unclear what change is needed, or multiple interpretations possible                                                                                                                                                        | Auto-skip if no safety signal, else Skip-plan     | Skip-plan leaning clarify                 |
| **Disagree / Skip**                 | Feedback seems wrong, unnecessary, or misaligned with context we built together                                                                                                                                            | Auto-skip (Step 3.7)                              | Skip-plan (Step 3.6) leaning fix          |
| **Already done**                    | The requested change appears to already be in place                                                                                                                                                                        | Reply explaining it's done, resolve               | Reply explaining it's done, resolve       |
| **Question only**                   | Reviewer asked a question but didn't request a change                                                                                                                                                                      | Gate: get the answer to reply with                | Gate: get the answer to reply with        |

**Cheap-change-first — this governs the bot lean above.** Before auto-skipping any bot comment, ask: *is the change cheap and non-divergent?* A change that is small, has no negative performance impact (neutral, or an improvement), and does not pull against the PR's deliberate direction should just be **done** (route to Actionable / Step 4) — even when it's "only" a style/consistency/efficiency nit. The fix costs less than a round-trip skip reply and the reviewer was right. Auto-skip is not a dumping ground for "minor but correct".

**What auto-skip is actually for.** Auto-skip (Step 3.7) is reserved for bot comments that genuinely **diverge from our intended work** — they push in a different direction from the design we deliberately chose, or try to undo something that was the point of the PR. So: bot correct + cheap → fix it (Step 4); bot correct but genuinely out of scope → split via Step 3.5; bot pulling the wrong way → auto-skip. "It's a small nit" is a reason to *do* it, not to skip it.

**Maintainability-first — action is the default, even when it's not cheap.** Reuse / DRY / readability / naming / structure / dead-code comments are maintainability value, and maintainability matters long-term — so **default to actioning them in this PR**, not deferring. This extends Cheap-change-first past the "cheap" bar: a reviewer pointing out duplicated logic, a parameterisable helper, or a structure that will drift is usually *right*, and the cost of fixing it now (one focused refactor + tests) is almost always less than the cost of it rotting across copies. Do it now unless there's a concrete reason not to — and "it's a bit bigger than a one-liner" is **not** that reason. Deferring a maintainability comment to a follow-up is the exception, reserved for when the refactor is genuinely large/risky *and* the PR is time-critical (e.g. an urgent prod hot-fix); even then it's gated (Step 3.6 Skip-plan for humans, Step 3.5 issue-split with approval) and never silently skipped. When unsure, lean fix-now.

**Reliability / edge-case carve-out — never auto-skip.** A bot flagging behaviour under edge conditions — missing / deleted / null records, empty results, resource exhaustion, repeated-failure or cache-miss storms, unbounded retries, exceptions on the unhappy path — is raising a correctness/reliability concern, not a style nit. These are never auto-skipped. Fix them (Step 4), or if genuinely out of scope escalate via Skip-plan (Step 3.6) so a human decides. Silently resolving such a thread hides the concern from the human reviewer (the PR shows "0 open threads") and can ship the defect straight through the merge gate.

**Bot trigger phrases that route to Style / consistency / preference, not Actionable.** If the comment uses any of these phrasings AND isn't flagging a real bug/security/correctness issue, it's a candidate for the style row — but apply Cheap-change-first: if the suggested tweak is cheap and doesn't diverge from our direction, just do it rather than skipping. The phrasings:

- "for consistency"
- "consider aligning"
- "established pattern" / "matches the convention" / "in line with..."
- "prefer X over Y" with no correctness reason given
- "unless there's a specific need" (a hedge that signals taste, not bug)
- import-order, naming, casing, formatting, or version-bump nits

**New-line suspicion (bot).** Check the diff hunk: if the bot is flagging a line *this PR introduced* (a `+` line), lean toward treating the choice as deliberate rather than a defect. But "deliberate" is not a reason to auto-skip a cheap, correct improvement — apply Cheap-change-first and just make the tweak. Reserve auto-skip for when the bot is steering away from the direction the PR deliberately chose.

**Bot reviewers commonly miss context.** Copilot and other bots don't see the conversation, the linked issue threads, or the deliberate design decisions that produced the diff. When a bot's skip-category comment conflicts with context we built together, just auto-skip via Step 3.7 — no gate. Gating each bot skip re-creates the friction we're avoiding. Every auto-skip lands in the Step 8 final summary for audit.

**Safety carve-out (bot):** if the bot is flagging a plausible correctness, security, data-loss, or reliability/edge-case issue (see the Reliability carve-out above) — not a style/taste disagreement — treat it as Actionable or route through Skip-plan. Auto-skip is for direction-divergent comments only, never for ignoring real bug or reliability reports.

**Not for scope-creep splits.** Auto-skip dismisses the comment. If the bot is *right* but the change is genuinely out of scope (worth a separate issue), use Step 3.5 — that path is always gated, regardless of author. Don't auto-skip valid out-of-scope feedback just because the author is a bot.

**Human reviewers usually have context we don't.** They've seen the team discussions, the past incidents, the conventions that aren't written down. Treat human feedback as presumptively actionable. Every human skip goes through Step 3.6 Skip-plan — no shortcuts.

**Question-only comments are a gate.** Group them in a table:

| #   | File | Line | Reviewer | Author | Comment Summary | Your Assessment | Suggested Action |
| --- | ---- | ---- | -------- | ------ | --------------- | --------------- | ---------------- |

Direct mode: present via `EnterPlanMode` and wait for User's answers. Delegated mode: SendMessage the table to the lead — the lead answers directly when the answer is clearly established in session/PR context (that's within its authority), and asks User for the rest. Wait for decisions on each before continuing.

### 3.5. Scope-creep triage

Before sending "Disagree / Skip" comments through a gate, assess whether the requested change is in scope or not.

**Key principle: minor fixes are usually worth doing in-PR.** Filing a separate issue for a one-line change (like fixing a wrong HTTP status code, renaming a method, or correcting a typo) creates more overhead than just doing it. Only file separate issues for changes that would meaningfully expand the PR's scope or risk.

For each thread categorized as "Disagree / Skip":

1. **Read the linked issue** referenced in the PR body (`Closes #N`, `Fixes #N`, `Resolves #N`) via `gh issue view <n> --repo <owner>/<repo> --json title,body,labels,milestone`. If no issue is linked, treat the PR title and description as the scope.
2. **Classify the change size:**
   - **Minor** (1-5 lines, touches files already in the PR diff, no new risk): just do it. Don't file an issue.
   - **Medium** (touches files in the PR diff but adds meaningful new behavior or test surface): gate on whether to fix in-PR or split out.
   - **Large** (touches files outside the PR diff, adds significant new scope, or changes unrelated subsystems): gate before filing as a separate issue.
3. **For medium or large changes** → open the gate before taking any action. Direct mode: `EnterPlanMode`. Delegated mode: SendMessage the same content to the lead — on **personal-tier repos** (see SKILL.md) the lead approves or rejects the split itself, escalating to User only when genuinely uncertain; on **standard-tier repos** the lead forwards to User. The gate content must include:
   - The original comment (quoted) and reviewer login
   - Why you believe it's out of scope for this PR
   - The proposed issue title and body (using the template below)
   - Clear options: approve creating the issue, or reject (handle as regular Disagree/Skip)

   **Never create a GitHub issue without gate approval.** Who approves varies by tier; silent creation never happens.

   Issue body template (for use after approval):

   ```markdown
   Split off from PR review feedback on #<pr-number>.

   ## Original feedback

   > <quoted comment body>

   — @<reviewer-login> on [this review comment](comment-html-url)

   ## Source

   - PR: #<pr-number> — <pr-title>
   - File: `<path>:<line>`
   ```

   Labels: judgement call per comment. Only copy labels from the parent issue if the new work clearly shares the same domain. Default: no labels copied — rely on repo defaults. Do not inherit milestone.

   After approval:
   - Create the issue with `gh issue create`.
   - Reply on the review thread (append the mandatory sign-off footer — see top of this reference):
     > This feels out of scope for this PR — tracked separately in #&lt;new-issue&gt;. Happy to prioritize there.
     >
     > ---
     > \- Posted autonomously by 🤖 with permission... if you believe this is the incorrect response, please unresolve the comment and it will be flagged
   - Resolve the thread.
   - Record the new issue number for the final summary.

   If rejected:
   - Leave the thread in the "Disagree / Skip" bucket and route it through Step 3.6 Skip-plan.

### 3.6. Human Skip-plan flow

For **human-authored** threads the agent wants to skip — **Disagree / Skip**, **Contradicts task intent**, or **Ambiguous** — gate every skip. Humans usually have context we don't; skipping their feedback without review is how you silently ship against the team's judgment.

**Never resolve a human thread as "won't fix" without this gate.** Who sits behind the gate varies: direct mode → User via plan mode; delegated mode → the lead, who on **personal-tier repos** may decide itself (human reviewers are rare there — but a human comment conflicting with the task's explicit goal still goes to User), and on **standard-tier repos** always forwards to User.

Flow:

1. **Write the skip-plan content** using this exact section structure (template — fill each section, do not skip any). Direct mode: write it to the plan-file path the plan-mode system reminder names, overwriting that file's entire contents — `ExitPlanMode` renders only the announced file, so writing to a different path shows User a stale plan. Delegated mode: the same content is the SendMessage body.

   ```markdown
   # Skip-plan for PR #<N> — <one-line thread topic>

   **PR:** https://github.com/<owner>/<repo>/pull/<N>
   **Thread:** [`<file>:<line>`](<comment-url>) — @<reviewer-login> (bot|human, <safety-signal|style|intent|ambiguous>)

   ## Comment (quoted)

   > <verbatim comment body>

   ## Context the reviewer didn't have

   - <bullet 1: linked issue requirement / earlier conversation decision / explicit design trade-off>
   - <bullet 2 …>
   - <bullet 3 …>

   ## Why I recommend skipping

   <2–4 sentences. Specific reasoning tied to the context above. Name the cost of fixing in-scope vs the value. Mention whether a follow-up issue is the right home.>

   ## Proposed reply

   > <exact text we'd post — respectful, references the design decision, offers to revisit if they disagree>
   >
   > ---
   > \- Posted autonomously by 🤖 with permission... if you believe this is the incorrect response, please unresolve the comment and it will be flagged

   (The sign-off footer is mandatory on every automated reply — see top of this reference. Show it in the plan so the approver sees the exact text that will be posted.)

   ## Decision requested

   I recommend **skip with this reply**. The other options are:

   - [x] **Skip with this reply** — post the proposed reply, resolve the thread.
   - [ ] **Fix it anyway** — route to the implementation phase (which approach: <list concrete options if relevant>?).
   - [ ] **Ask the reviewer a clarifying question instead** — leave the thread open.
   ```

   **Recommendation framing is mandatory.** The "Decision requested" section must lead with `I recommend **<option>**. The other options are:` so the approver can approve as-is or push back in one read. Mark the recommended option with `[x]` and the others with `[ ]`.

   The recommendation defaults to "Skip with this reply" because that's the path that brought us into 3.6, but if during drafting it becomes clear "Fix it anyway" is the right call (e.g. a one-line fix the reviewer was correct about), recommend that instead and word the other two options as alternatives.

   No implementation-plan recap, no glossary, no risks section — just the skip context. One screen of relevant material. If the reviewer's comment specifically references a design decision documented elsewhere, link to it; do not paste it.

   For multiple skip candidates in one batch, repeat the **Thread / Comment / Context / Why / Reply / Decision** block once per candidate under a single H1. Each block carries its own recommendation.

2. Open the gate (direct: `EnterPlanMode` → overwrite announced plan file → `ExitPlanMode`; delegated: SendMessage to lead) and wait for the decision. Never proceed on a skip without explicit approval from the gate.
3. On **skip approved**:
   - Post the approved reply: `gh api repos/<owner>/<repo>/pulls/<number>/comments -f body="<reply>" -f in_reply_to=<comment_id>`.
   - Resolve the thread via the `resolveReviewThread` GraphQL mutation (see Step 6 for the exact syntax).
4. On **fix instead** → route the thread into Step 4 (Fix actionable comments) with the reviewer's ask as the spec.
5. On **ask reviewer instead** → post the clarifying question as a reply, leave the thread open, move on. The next pass picks it up once the reviewer responds.

### 3.7. Bot auto-skip flow

For **bot-authored** threads that **diverge from our deliberate direction** (Disagree / Skip, Contradicts task intent, Ambiguous with no safety signal) — just skip. Bots don't have the context to be right about intent; gating each one re-creates the friction we're avoiding. This flow is gate-free in both modes.

**This step is only for direction-divergent comments.** Apply Cheap-change-first (Step 3) before you land here: if the bot is correct and the change is cheap and non-divergent, it is **not** a skip — fix it via Step 4. Auto-skip is for "the bot is steering the wrong way", not for "the bot is right but it's a small nit".

**Not for scope-creep splits.** If the bot feedback is genuinely valid but out of scope (worth tracking separately), route to Step 3.5 instead — issue creation is never gate-free.

**Not for safety / reliability comments.** If the bot is flagging a plausible correctness, security, data-loss, or edge-case reliability issue (missing/deleted/null records, resource exhaustion, repeated-failure storms, unhappy-path exceptions) — not a style/taste disagreement — route it to Actionable (Step 4) or to Step 3.6 Skip-plan. Auto-skip is never for ignoring a real bug or reliability report.

Flow:

1. Draft a reply in the same spirit as a human-skip reply — respectful, references the design decision, offers to revisit. Humans scrolling the PR will read it; bots won't, but tone still matters for the public record. **Append the mandatory sign-off footer** (see top of this reference) as the last block of the reply body.
2. Post the reply: `gh api repos/<owner>/<repo>/pulls/<number>/comments -f body="<reply>" -f in_reply_to=<comment_id>`.
3. Resolve the thread via the `resolveReviewThread` GraphQL mutation (see Step 6).
4. Record the auto-skip in the run log so Step 8's final summary lists every one of them (reviewer, `file:line`, one-line reason, comment link). Auditability is the trade-off for removing the gate — without it, User has no visibility into what got silently dismissed.
5. No gate. Move to the next thread.

### 4. Fix actionable comments

For each actionable comment:

1. **Read the file** at the referenced path and line.
2. **Understand the context** — read the diff hunk from the comment and surrounding code.
3. **Make the fix** following the project's coding standards (check CLAUDE.md).
4. **Track the mapping** between each comment thread and the fix applied.

Group related fixes logically — if multiple comments touch the same file or feature, fix them together.

### 5. Commit and push

Check if `but` (GitButler CLI) is available:

```bash
which but 2>/dev/null
```

**If `but` is available**, use the GitButler skill conventions:

1. `but status --json` — get current state and IDs.
2. `but commit <branch> -m "<msg>" --changes <ids> --json --status-after` — commit the fixes.
3. `but push` — push to remote.

**If `but` is NOT available**, use standard git:

1. `git add <specific-files>`
2. `git commit -m "<msg>"`
3. `git push`

**Commit message format:**

```
Fix PR review feedback

Address reviewer comments:
- <brief summary of fix 1>
- <brief summary of fix 2>
- ...
```

If changes are substantial, split into multiple logical commits rather than one giant commit.

Never tell a reviewer a change is fixed before the fixing commit is on the remote (from the personal-repo-merge lineage — it applies everywhere).

### 6. Reply to and resolve each comment

For each addressed comment thread, reply and resolve:

```bash
# Reply to the comment thread
gh api repos/<owner>/<repo>/pulls/<number>/comments -f body="<reply>" -f in_reply_to=<comment_id>

# Resolve the thread via GraphQL
gh api graphql -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { isResolved }
    }
  }
' -f threadId="<thread_node_id>"
```

**Reply format for fixed comments** (append the mandatory sign-off footer — see top of this reference):

> Done - <brief description of what was changed>.
>
> ---
> \- Posted autonomously by 🤖 with permission... if you believe this is the incorrect response, please unresolve the comment and it will be flagged

**Reply format for "already done" comments** (append the mandatory sign-off footer — see top of this reference):

> This is already in place - <brief explanation of where/how>.
>
> ---
> \- Posted autonomously by 🤖 with permission... if you believe this is the incorrect response, please unresolve the comment and it will be flagged

### 7. Handle gate-decided comments

After the gate responds on question-only comments from Step 3:

- **Fix it**: Apply the fix, commit, push, reply, and resolve.
- **Skip/won't do**: Handled by Step 3.6 Skip-plan — not here. Route the thread there.
- **An answer to a question**: Reply with the answer, then resolve the thread.
- **Discuss further**: Leave the thread open and note it in the final summary.

### 8. Final summary

Provide a concise summary (in delegated mode this goes to the lead, who folds it into run reporting):

```
PR feedback addressed:
- R re-opened threads deferred to User (see list below — these need YOUR action)
- X comments fixed and resolved
- Y bot comments auto-skipped (see list below)
- Z human comments resolved after Skip-plan approval
- W comments resolved as already-done
- V comments left open (pending further discussion)

Re-opened threads (need User to handle):
- <reviewer> @ <file:line> — <thread URL>
- ...

Bot auto-skips:
- <reviewer> @ <file:line> — <one-line reason> — <comment link>
- ...

Commits: <commit hash(es)>
Push: done
```

The **Re-opened threads** list is mandatory whenever Step 2.6 found any. It comes FIRST in the summary — do not bury it below auto-skip or fix tallies.

The **Bot auto-skips** list is mandatory whenever Step 3.7 fired at least once. Without it there's no visibility into what got silently dismissed — and that's the whole trade for removing the gate.

## Key rules

- **Sign-off footer on every automated reply.** Every reply ends with the literal sign-off block (see "Reply sign-off" at the top). Do not paraphrase or shorten — the exact string is the signal Step 2.6 uses to detect re-opened threads in future runs.
- **Never re-resolve a thread that was previously resolved.** If a thread contains a comment with the sign-off string, treat it as **re-opened by the reviewer** — bucket it into `reopenedThreads`, surface it FIRST through the gate and FIRST in the Step 8 summary, and do not touch it. User resolves these himself, in every mode and tier.
- **Gates are mode-routed, never skipped.** Direct mode: `EnterPlanMode`/`AskUserQuestion` to User. Delegated mode: SendMessage to the lead, who applies the SKILL.md authority table. The gate content is identical either way.
- **Classify reviewer author first.** Every unresolved thread gets a `bot` or `human` tag before triage (Step 2.5). The tag picks the flow: bot → Step 3.7 auto-skip allowed, human → Step 3.6 Skip-plan always.
- **Cheap-change-first.** Before auto-skipping a bot comment, ask if the change is cheap (small, no negative perf impact — neutral or an improvement) and non-divergent. If so, just **do it** (Step 4) — even a style/consistency/efficiency nit. The fix is cheaper than the skip round-trip and the reviewer was right.
- **Maintainability-first.** Reuse / DRY / readability / structure / dead-code comments default to **action in this PR**, even when the fix is more than a one-liner. Deferring one is the exception (genuinely large/risky refactor on a time-critical PR), always gated, never silent. When unsure, lean fix-now.
- **Auto-skip = divergence only.** Step 3.7 is reserved for bot comments that push against the PR's deliberate direction. Correct + cheap → fix; correct + out of scope → Step 3.5 split; wrong direction → skip.
- **Reliability / edge-case is never auto-skip.** A bot flagging behaviour under edge conditions is a correctness/reliability concern. Fix it (Step 4) or escalate via Skip-plan (Step 3.6). Auto-resolving it hides the concern from the human reviewer and can ship the defect through the merge gate.
- **Human context is usually thick; always gate.** Every human skip goes through Step 3.6's Skip-plan. No exceptions.
- **Issue creation is always gated.** Step 3.5 requires gate approval regardless of author (lead on personal tier, User on standard). Don't use auto-skip to dismiss valid out-of-scope feedback — route it through Step 3.5.
- **Audit trail mandatory.** Every Step 3.7 auto-skip lands in the Step 8 final summary (reviewer, `file:line`, reason, comment link).
- **Human reviewing against task intent → escalate hard.** If a *human* says "don't do X" where X is the PR's explicit goal, route to Step 3.6 with a loud flag and get it to User — this is a real disagreement between the reviewer and the task. (A *bot* saying the same is the exact noise auto-skip exists for.)
- **Never resolve a comment without replying first** — always leave a reply explaining what was done.
- **Never fix ambiguous comments without gating** — when in doubt, gate.
- **Respect project conventions** — read CLAUDE.md and follow established patterns.
- **Don't over-fix** — only change what the reviewer asked for. Don't refactor surrounding code.
- **Preserve the reviewer's intent** — if a comment says "rename X to Y", rename it to Y, not Z.
- **Handle pagination** — PRs can have many comments. Always use `--paginate` with `gh api`.
- **Handle outdated comments** — outdated threads are still visible to reviewers and must be resolved. Read the current file to see if the feedback was already addressed by subsequent changes. If so, reply explaining it's done. If not, fix it. Never skip an unresolved thread just because it's marked outdated.
- **Always fetch check-run annotations** — Step 1.5 is mandatory. SonarCloud and other linters post findings as check-run annotations, not review threads. Skipping this step ships code with unaddressed lint/Sonar findings.
- **Use `but` when available** — follow the GitButler skill conventions for all write operations.
