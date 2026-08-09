# Reference: closing comments on linked issues (lead, User-gated)

Mandatory after a merge when the PR body linked issues (`Closes #N` / `Fixes #N` / `Resolves #N`). GitHub
auto-closes without context; the comment supplies it.

1. Draft 3–6 tight lines per issue: root cause as it relates to the issue's symptom, the fix, PR link +
   merge SHA, and an explicit retest ask (tagging the reporter) when a platform couldn't be verified
   locally.
2. Open a **fresh** `EnterPlanMode` and overwrite the announced plan file — the harness reuses one plan
   file and `ExitPlanMode` renders only that file, so stale implementation-plan content must be wiped,
   not appended to. Format:

   ```markdown
   # Closing comment for PR #<pr-n>

   **PR:** https://github.com/<owner>/<repo>/pull/<pr-n> (merged as <short-sha>)
   **Issue:** https://github.com/<owner>/<repo>/issues/<issue-n> — <issue title>
   **Reporter:** @<reporter-login>

   ## Expected closing comment

   <the literal comment body that will be posted>
   ```

   Multiple issues: one H1, repeat the block per issue, one approval for the batch.
3. On approval: `gh issue comment <issue-n> --repo <owner>/<repo> --body "<approved body>"`. The gate
   holds even when the body looks obviously fine — only User knows whether to ping the reporter, soften
   tone, or skip an issue. Skip the step entirely only when no issues were linked; an already-closed issue
   still gets its comment (audit trail over state).
