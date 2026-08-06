---
name: github-security-alerts
description: "Review and remediate GitHub security alerts (Dependabot, code scanning, secret scanning). Only invoke explicitly with /github-security-alerts. Analyzes open alerts, categorizes as fix or dismiss with reasoning, groups fixes into issues sized for independent agent work, and handles public repo safety."
---

# Skill: GitHub Security Alerts Review and Remediation

## Purpose

Fetch all open security alerts from a GitHub repository (Dependabot, code scanning, secret scanning), analyze each alert for relevance and risk, present a remediation plan with fix groups and dismiss candidates, then execute approved actions: create issues for fixes (or fix directly for public repos), and dismiss safe-to-ignore alerts.

## Workflow

### 1. Identify the target repo

Determine the repository to audit. If the user specified a repo, use it. Otherwise, detect from the current directory:

```bash
gh repo view --json owner,name -q '"\(.owner.login)/\(.name)"'
```

Also check visibility for later use:

```bash
gh repo view --json visibility -q '.visibility'
```

If detection fails, ask the user for the repo.

### 2. Detect issue types

Inspect the repo to understand how it categorizes issues. Check in priority order:

#### 2a. Issue templates

```bash
gh api /repos/{owner}/{repo}/contents/.github/ISSUE_TEMPLATE 2>/dev/null
```

If the directory exists, fetch each `.yml`, `.yaml`, and `.md` file and extract:
- `name` — the template display name
- `description` — what the template is for
- `labels` — automatically applied labels
- `body` — the form structure (for YAML templates)

Use the template structure when creating issues later (match field names, section headers, label conventions).

#### 2b. Labels

```bash
gh label list --repo {owner}/{repo} --json name,description --limit 200
```

Look for type-like labels: `bug`, `enhancement`, `security`, `dependencies`, `vulnerability`, etc. Note which exist for use when creating issues.

#### 2c. Fallback defaults

When the repo has no issue templates and no meaningful type labels, use these built-in defaults for consistency:

**Security Fix** — For vulnerability remediation issues
- Labels: `security`
- Body structure:
```markdown
## Security vulnerability remediation

### Alerts addressed
{alert details}

### Impact
{vulnerability impact description}

### Remediation steps
{numbered concrete steps}

### Files to modify
{file paths}

### Verification
{checklist}

### References
{advisory links}
```

**Security Chore** — For batch low-severity dependency updates
- Labels: `security`, `chore`
- Body structure:
```markdown
## Dependency security updates

### Packages to update
{table of packages, current version, target version, severity}

### Steps
{update commands}

### Verification
{checklist}
```

**Security Incident** — For secret scanning findings requiring rotation
- Labels: `security`, `incident`
- Body structure:
```markdown
## Secret exposure remediation

### Exposed secrets
{secret type, location, exposure details}

### Immediate actions
{rotation steps, revocation commands}

### Prevention
{steps to prevent recurrence}
```

When using fallback defaults, check if the required labels exist on the repo before using them. If they do not exist, create them (with user approval) or skip labels rather than failing.

### 3. Fetch all open security alerts

Run all three API calls. Each may return a 404 if the feature is not enabled — handle this gracefully.

**Dependabot alerts:**
```bash
gh api "/repos/{owner}/{repo}/dependabot/alerts?state=open&per_page=100" --paginate -q '.[] | {
  number,
  state,
  severity: .security_advisory.severity,
  cvss: .security_advisory.cvss.score,
  ghsa_id: .security_advisory.ghsa_id,
  cve_id: (.security_advisory.cve_id // "none"),
  summary: .security_advisory.summary,
  description: .security_advisory.description,
  package_name: .security_vulnerability.package.name,
  package_ecosystem: .security_vulnerability.package.ecosystem,
  vulnerable_range: .security_vulnerability.vulnerable_version_range,
  patched_version: (.security_vulnerability.first_patched_version.identifier // "none"),
  manifest_path: .dependency.manifest_path,
  scope: (.dependency.scope // "unknown"),
  url: .html_url,
  created_at
}'
```

**Code scanning alerts:**
```bash
gh api "/repos/{owner}/{repo}/code-scanning/alerts?state=open&per_page=100" --paginate -q '.[] | {
  number,
  rule_id: .rule.id,
  rule_description: .rule.description,
  severity: .rule.security_severity_level,
  tool: .tool.name,
  file: .most_recent_instance.location.path,
  start_line: .most_recent_instance.location.start_line,
  end_line: .most_recent_instance.location.end_line,
  message: .most_recent_instance.message.text,
  state,
  url: .html_url,
  created_at
}'
```

**Secret scanning alerts:**
```bash
gh api "/repos/{owner}/{repo}/secret-scanning/alerts?state=open&per_page=100" --paginate -q '.[] | {
  number,
  secret_type: .secret_type,
  secret_type_display: .secret_type_display_name,
  state,
  url: .html_url,
  created_at,
  push_protection_bypassed: .push_protection_bypassed
}'
```

**Error handling for each call:**
- **404**: Report "not enabled on this repo" and continue with the other alert types.
- **403**: Report "insufficient permissions" and continue.
- **Empty array**: Report "0 open alerts" for that type.

### 4. Analyze and categorize each alert

For each alert, determine whether it should be **fixed** or **dismissed**. At this stage your goal is coverage: surface every open alert into one of the two buckets with a reason. Do not silently drop an alert because it seems minor — a low-severity or likely-false-positive alert still gets listed (in the dismiss bucket with its reason) so the user sees it in the plan and can override. The user-facing plan in Step 6 is where the bar gets applied, not here.

#### Dependabot alerts

**Fix when:**
- The dependency is a runtime/production dependency (scope is not "development")
- A patched version exists
- The severity is high or critical
- The CVSS score is >= 7.0

**Dismiss candidates:**
- `not_used` — The vulnerable function/code path is not used by this project. Verify by grepping the codebase for imports of the affected package and checking if the vulnerable API surface is called.
- `inert` — Development-only dependency (scope: "development") that does not affect production builds or runtime.
- `tolerable_risk` — Low severity (CVSS < 4.0), no known exploit, and no patched version available yet.
- `no_bandwidth` — Do NOT use this reason autonomously. Only suggest if the user explicitly asks to defer.

#### Code scanning alerts

**Fix when:**
- Severity is error or warning with security implications
- The flagged code is in production paths (not test files, not generated code)
- The rule identifies a real pattern (SQL injection, XSS, path traversal, etc.)

**Dismiss candidates:**
- `false positive` — The tool flagged something that is not actually vulnerable when you read the code context.
- `used in tests` — The alert is in a test file and the pattern is intentional.
- `won't fix` — The code is in a deprecated path scheduled for removal, or the risk is accepted.

**Codebase verification required:** For code scanning alerts, read the flagged file and line before categorizing. Do not dismiss based on rule description alone.

#### Secret scanning alerts

**Fix when:**
- The secret appears to be a real, active credential
- The secret type is a high-value target (API keys, tokens, passwords, private keys)

**Dismiss candidates:**
- `revoked` — The secret has already been rotated/revoked (must confirm with user).
- `false_positive` — The detected string is not actually a secret (placeholder, example value, hash).
- `used_in_tests` — Test fixture, not a real credential.
- `wont_fix` — Do NOT use autonomously. Only if the user explicitly accepts the risk.

**Secret scanning always requires user confirmation before dismissal.** Never auto-dismiss a secret scanning alert.

**Default to fix when uncertain.** False negatives (missing a real vulnerability) are worse than false positives (creating an unnecessary issue).

### 5. Group fixes into issues

#### 5a. Public repo safety check

Check the repo visibility (fetched in step 1). For **public repos**, ask the user:

> "This is a public repo. Creating multiple security issues at once could give attackers a heads-up before fixes are merged. Options:
> 1. **Fix now, no issue** (Recommended) — Skip issue creation. Work on the highest-priority fix immediately. The PR references the security alert directly (e.g., 'Fixes GHSA-xxxx'). After it's merged, run this skill again for the next batch.
> 2. **Create all issues at once** — Create all issues now (risk: public visibility before fixes land).
> 3. **Create as private issues** — If the repo supports private vulnerability reporting, use that instead."

For **private repos**, proceed with full grouping.

#### 5b. Grouping logic

When grouping, apply these criteria in order:

**Logical grouping:**
1. **Same advisory family** — Multiple alerts for the same CVE/GHSA across different manifests become one issue.
2. **Same package upgrade** — Multiple alerts fixed by upgrading the same package (e.g., upgrading express fixes 3 CVEs).
3. **Same ecosystem batch** — Related low-severity alerts in the same ecosystem (e.g., "Update 4 npm dev dependencies with moderate vulnerabilities").
4. **Same code scanning rule** — Multiple instances of the same rule (e.g., "Fix 5 instances of missing input validation").
5. **Individual** — Critical or complex alerts that deserve their own focused issue.

**Size-based splitting:** After logical grouping, estimate the change size for each group:
- **Small fixes** (a few lines each — version bumps, config changes): group aggressively. Multiple small fixes in one issue is fine since a reviewer can review commit-by-commit.
- **Medium fixes** (tens of lines, localized changes): group related ones but keep to a reviewable PR size.
- **Large fixes** (hundreds+ lines, refactors, breaking changes): each gets its own issue regardless of logical grouping. If a single fix would be 1000+ lines, note in the issue body that it may need further decomposition.

The goal: each issue should produce a single, reviewable PR.

Map each group to the best issue type/template detected in step 2.

### 6. Present the plan

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

Wait for user approval. The user may:
- Move items between fix and dismiss
- Adjust grouping or issue titles
- Edit draft descriptions
- Ask questions about specific alerts

### 7. Execute after approval

#### If "Fix now, no issue" mode (public repo default)

1. Present the highest-priority fix group's full remediation details — the same information that would go in an issue body, but as direct instructions.
2. The user/agent works on the fix directly. The resulting PR should reference the security alert (e.g., "Fixes GHSA-xxxx-xxxx-xxxx") instead of a GitHub issue.
3. Dismiss approved alerts via `gh api PATCH` (see dismiss API details below).
4. Print summary: what was addressed, what was dismissed, how many alerts remain. Suggest re-running the skill for the next batch.

#### If "Create issues" mode (private repos or user-selected)

**Create issues** via `gh issue create` with appropriate labels, using the repo's template structure or the fallback defaults.

Issue body must include:
- **Alerts addressed** — Alert numbers, summaries, severity, CVSS scores, advisory IDs, alert URLs
- **Impact** — What the vulnerability allows and whether it affects this project's usage
- **Remediation steps** — Concrete, numbered steps (exact commands, version numbers, file paths)
- **Files to modify** — Specific manifest paths, lock files, source files
- **Verification checklist** — How to confirm the fix worked (re-run audit, check alert state, run tests)
- **References** — Advisory URLs, package changelogs

Each issue must be self-contained: an agent or developer should be able to fix it without re-researching the vulnerability.

**Check for "security" label** before using it:
```bash
gh label list --repo {owner}/{repo} -L 200 --json name -q '.[].name' | grep -i security
```
If it does not exist and you need it (fallback templates), ask the user before creating it.

#### Dismiss alerts

**Dependabot:**
```bash
gh api --method PATCH "/repos/{owner}/{repo}/dependabot/alerts/{number}" \
  -f state=dismissed \
  -f dismissed_reason="{reason}" \
  -f dismissed_comment="{justification}"
```
Valid reasons: `fix_started`, `inert`, `no_bandwidth`, `not_used`, `tolerable_risk`

**Code scanning:**
```bash
gh api --method PATCH "/repos/{owner}/{repo}/code-scanning/alerts/{number}" \
  -f state=dismissed \
  -f dismissed_reason="{reason}" \
  -f dismissed_comment="{justification}"
```
Valid reasons: `false positive`, `won't fix`, `used in tests`

**Secret scanning:**
```bash
gh api --method PATCH "/repos/{owner}/{repo}/secret-scanning/alerts/{number}" \
  -f state=resolved \
  -f resolution="{reason}" \
  -f resolution_comment="{justification}"
```
Valid reasons: `false_positive`, `wont_fix`, `revoked`, `used_in_tests`

Note: Secret scanning uses `state=resolved` and `resolution` (not `state=dismissed` and `dismissed_reason`).

#### Final summary

After execution, present:

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

## Key Rules

1. **Always present the plan before acting.** Never create issues or dismiss alerts without explicit user approval.
2. **When in doubt, fix.** Err on the side of creating an issue rather than dismissing an alert.
3. **Never auto-dismiss secret scanning alerts.** Secrets require explicit user confirmation.
4. **Verify code scanning alerts by reading the code.** Do not dismiss based on rule description alone.
5. **Handle 404s gracefully.** Not every repo has all three alert types enabled. Report what is available and proceed.
6. **Issues must be self-contained.** Each issue should have enough context for an agent to fix it independently.
7. **Use `--paginate` for all API calls.** Alert lists can be large.
8. **Respect dismiss reason vocabularies.** Each alert type has its own valid reasons. Using wrong reasons causes API errors.
9. **Group logically and by size.** Small version bumps can be batched; large refactors get individual issues.
10. **Fix and dismiss sets must be mutually exclusive.** Do not create an issue for an alert you are also dismissing.
11. **Public repos default to fix-now mode.** Avoid broadcasting vulnerabilities via public issues before fixes land.
12. **Match the repo's issue conventions.** Use detected templates, labels, and structure. Fall back to built-in defaults only when nothing is detected.
13. **Check label existence before using.** Do not assume labels exist. Check first, ask before creating.
