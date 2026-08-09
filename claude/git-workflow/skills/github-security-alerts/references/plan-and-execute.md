# Reference: grouping, the plan, and execution

## Grouping logic (Step 5)

Apply these criteria in order.

**Logical grouping:**
1. **Same advisory family** — multiple alerts for the same CVE/GHSA across different manifests become
   one issue.
2. **Same package upgrade** — multiple alerts fixed by upgrading the same package (e.g. upgrading
   express fixes 3 CVEs).
3. **Same ecosystem batch** — related low-severity alerts in the same ecosystem (e.g. "Update 4 npm dev
   dependencies with moderate vulnerabilities").
4. **Same code scanning rule** — multiple instances of the same rule (e.g. "Fix 5 instances of missing
   input validation").
5. **Individual** — critical or complex alerts that deserve their own focused issue.

**Size-based splitting:** after logical grouping, estimate the change size for each group:
- **Small fixes** (a few lines each — version bumps, config changes): group aggressively. Multiple small
  fixes in one issue is fine since a reviewer can review commit-by-commit.
- **Medium fixes** (tens of lines, localized changes): group related ones but keep to a reviewable PR
  size.
- **Large fixes** (hundreds+ lines, refactors, breaking changes): each gets its own issue regardless of
  logical grouping. If a single fix would be 1000+ lines, note in the issue body that it may need further
  decomposition.

The goal: each issue should produce a single, reviewable PR. Map each group to the best issue
type/template detected via `references/issue-templates.md`.

## Presenting the plan (Step 6)

Enter plan mode and present:

```markdown
## Security Alert Review: {owner}/{repo}

### Summary
| Type | Total | Fix | Dismiss | Not Enabled |
|------|-------|-----|---------|-------------|
| Dependabot | X | Y | Z | - |
| Code scanning | X | Y | Z | - |
| Secret scanning | X | Y | Z | - |

### Severity breakdown
- Critical: N
- High: N
- Medium: N
- Low: N

---

### Issues to create

#### Issue 1: {draft title}
**Type/Template:** {detected issue type or fallback template name}
**Alerts:** #12, #15, #18 (Dependabot)
**Why:** {explanation of the vulnerability and its impact}
**Suggested approach:** {concrete steps}
**Estimated change size:** Small / Medium / Large
**Files likely affected:** {manifest files, lock files, source files}
**Severity:** Critical

#### Issue 2: ...

---

### Alerts to dismiss

| # | Type | Alert | Reason | Justification |
|---|------|-------|--------|---------------|
| 1 | Dependabot #23 | lodash prototype pollution | inert | Dev dependency only, used in test toolchain |
| 2 | Code scanning #5 | Hardcoded credential | false positive | Value is a test fixture placeholder |

---

### Not actionable
- {Any alerts that need more information or user input before categorizing}
```

Wait for user approval. The user may move items between fix and dismiss, adjust grouping or issue
titles, edit draft descriptions, or ask questions about specific alerts.

## Executing after approval (Step 7)

### "Fix now, no issue" mode (public repo default)

1. Present the highest-priority fix group's full remediation details — the same information that would
   go in an issue body, but as direct instructions.
2. The user/agent works on the fix directly. The resulting PR should reference the security alert (e.g.
   "Fixes GHSA-xxxx-xxxx-xxxx") instead of a GitHub issue.
3. Dismiss approved alerts via the API calls in `references/fetch-and-classify.md`.
4. Print a summary: what was addressed, what was dismissed, how many alerts remain. Suggest re-running
   the skill for the next batch.

### "Create issues" mode (private repos or user-selected)

Create issues via `gh issue create` with appropriate labels, using the repo's template structure or the
fallback defaults (`references/issue-templates.md` covers both the body requirements and the label
check).

### Final summary

```markdown
## Execution complete

### Issues created (or fixes started)
- #{number} - {title} ({N alerts})

### Alerts dismissed
- {N} Dependabot alerts dismissed
- {N} code scanning alerts dismissed
- {N} secret scanning alerts dismissed

### Remaining
- {N} alerts still open (not addressed in this session)
{If public repo: "Run this skill again after merging the current fix to address the next batch."}
```
