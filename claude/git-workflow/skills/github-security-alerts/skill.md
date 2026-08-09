---
name: github-security-alerts
description: "Review and remediate GitHub security alerts (Dependabot, code scanning, secret scanning). Only invoke explicitly with /github-security-alerts. Analyzes open alerts, categorizes as fix or dismiss with reasoning, groups fixes into issues sized for independent agent work, and handles public repo safety."
user_invocable: true
---

# Skill: GitHub Security Alerts Review and Remediation

## Purpose

Fetch all open security alerts from a GitHub repository (Dependabot, code scanning, secret scanning),
analyze each alert for relevance and risk, present a remediation plan with fix groups and dismiss
candidates, then execute approved actions: create issues for fixes (or fix directly for public repos),
and dismiss safe-to-ignore alerts.

Reference files carry the procedures:

- `references/issue-templates.md` — detecting the repo's issue templates/labels, and the fallback
  templates and required issue-body content when none exist
- `references/fetch-and-classify.md` — the three alert-fetch API calls, the fix/dismiss criteria per
  alert type, and the dismiss API calls with their valid-reason vocabularies
- `references/plan-and-execute.md` — grouping logic, the plan-mode presentation template, and the
  execution/final-summary steps

## Workflow

### 1. Sync and identify the target repo

```bash
gh repo view --json owner,name -q '"\(.owner.login)/\(.name)"'
gh repo view --json visibility -q '.visibility'
```

If the user specified a repo, use that instead. If detection fails, ask the user. Visibility drives the
public-repo safety check in Step 5.

### 2. Detect issue conventions

Check for issue templates, then labels, then fall back to built-in defaults. Full detection commands and
the fallback template bodies are in `references/issue-templates.md` — read it before drafting any issue.

### 3. Fetch all open alerts

Run the three alert-type API calls (Dependabot, code scanning, secret scanning) in
`references/fetch-and-classify.md`. Handle 404 (not enabled) and 403 (no permission) gracefully per
alert type; report "0 open alerts" for an empty result.

### 4. Classify each alert: fix or dismiss

Apply the per-type fix/dismiss criteria in `references/fetch-and-classify.md`. At this stage the goal is
coverage — bucket every alert with a reason, don't drop one for looking minor; the plan (Step 6) is where
the user applies the bar. **Secret scanning alerts always require user confirmation before dismissal —
never auto-dismiss one.** Default to fix when uncertain: a false negative is worse than an unnecessary
issue.

### 5. Group fixes into issues

**Public repo safety check first.** For a **public repo**, ask the user:

> "This is a public repo. Creating multiple security issues at once could give attackers a heads-up
> before fixes are merged. Options:
> 1. **Fix now, no issue** (Recommended) — Skip issue creation. Work on the highest-priority fix
>    immediately. The PR references the security alert directly (e.g. 'Fixes GHSA-xxxx'). After it's
>    merged, run this skill again for the next batch.
> 2. **Create all issues at once** — Create all issues now (risk: public visibility before fixes land).
> 3. **Create as private issues** — If the repo supports private vulnerability reporting, use that
>    instead."

For **private repos**, proceed with full grouping. Grouping-by-advisory/package/size rules are in
`references/plan-and-execute.md`.

### 6. Present the plan

Enter plan mode (load `EnterPlanMode` via `ToolSearch` with `select:EnterPlanMode` first) and present the
summary table, issues-to-create list, dismiss table, and "not actionable" list. Exact format in
`references/plan-and-execute.md`. Wait for approval — the user may move items between fix/dismiss,
adjust grouping, edit descriptions, or ask questions.

### 7. Execute after approval

Public-repo default is "fix now, no issue"; private repos (or explicit user choice) create issues.
Dismiss approved alerts via the API calls in `references/fetch-and-classify.md`. Full execution steps and
the final-summary format are in `references/plan-and-execute.md`.

## Key Rules

1. **Always present the plan before acting.** Never create issues or dismiss alerts without explicit
   user approval.
2. **When in doubt, fix.** Err on the side of creating an issue rather than dismissing an alert.
3. **Never auto-dismiss secret scanning alerts.** Secrets require explicit user confirmation.
4. **Verify code scanning alerts by reading the code.** Do not dismiss based on rule description alone.
5. **Issues must be self-contained.** Each issue should have enough context for an agent to fix it
   independently.
6. **Respect dismiss reason vocabularies.** Each alert type has its own valid reasons — using the wrong
   one causes an API error.
7. **Fix and dismiss sets must be mutually exclusive.** Do not create an issue for an alert you are also
   dismissing.
8. **Public repos default to fix-now mode.** Avoid broadcasting vulnerabilities via public issues before
   fixes land.
9. **Match the repo's issue conventions.** Use detected templates, labels, and structure. Fall back to
   built-in defaults only when nothing is detected — and check label existence before using one.
