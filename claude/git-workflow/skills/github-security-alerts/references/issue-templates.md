# Reference: detecting and building issue templates

Run this before drafting any issue body, so created issues match the repo's own conventions instead of
a generic default.

## 1. Issue templates

```bash
gh api /repos/{owner}/{repo}/contents/.github/ISSUE_TEMPLATE 2>/dev/null
```

If the directory exists, fetch each `.yml`, `.yaml`, and `.md` file and extract:
- `name` — the template display name
- `description` — what the template is for
- `labels` — automatically applied labels
- `body` — the form structure (for YAML templates)

Use the template structure when creating issues later (match field names, section headers, label
conventions).

## 2. Labels

```bash
gh label list --repo {owner}/{repo} --json name,description --limit 200
```

Look for type-like labels: `bug`, `enhancement`, `security`, `dependencies`, `vulnerability`, etc. Note
which exist for use when creating issues.

**Check for a "security" label before using it** (needed either way — templates or fallback):

```bash
gh label list --repo {owner}/{repo} -L 200 --json name -q '.[].name' | grep -i security
```

If it does not exist, ask the user before creating it.

## 3. Fallback defaults

When the repo has no issue templates and no meaningful type labels, use these built-in defaults for
consistency.

**Security Fix** — for vulnerability remediation issues
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

**Security Chore** — for batch low-severity dependency updates
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

**Security Incident** — for secret scanning findings requiring rotation
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

When using fallback defaults, check if the required labels exist on the repo before using them. If they
do not exist, create them (with user approval) or skip labels rather than failing.

## 4. Issue body content (any template)

Regardless of which template applies, every issue body must include:

- **Alerts addressed** — alert numbers, summaries, severity, CVSS scores, advisory IDs, alert URLs
- **Impact** — what the vulnerability allows and whether it affects this project's usage
- **Remediation steps** — concrete, numbered steps (exact commands, version numbers, file paths)
- **Files to modify** — specific manifest paths, lock files, source files
- **Verification checklist** — how to confirm the fix worked (re-run audit, check alert state, run
  tests)
- **References** — advisory URLs, package changelogs

Each issue must be self-contained: an agent or developer should be able to fix it without re-researching
the vulnerability.
