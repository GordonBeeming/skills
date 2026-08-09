# Reference: fetching and classifying alerts

## Fetch all open alerts

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
- **404**: report "not enabled on this repo" and continue with the other alert types.
- **403**: report "insufficient permissions" and continue.
- **Empty array**: report "0 open alerts" for that type.

Use `--paginate` for all three calls — alert lists can be large.

## Classify each alert: fix or dismiss

For each alert, determine whether it should be **fixed** or **dismissed**. At this stage your goal is
coverage: surface every open alert into one of the two buckets with a reason. Do not silently drop an
alert because it seems minor — a low-severity or likely-false-positive alert still gets listed (in the
dismiss bucket with its reason) so the user sees it in the plan and can override. The user-facing plan is
where the bar gets applied, not here.

### Dependabot alerts

**Fix when:**
- The dependency is a runtime/production dependency (scope is not "development")
- A patched version exists
- The severity is high or critical
- The CVSS score is >= 7.0

**Dismiss candidates:**
- `not_used` — the vulnerable function/code path is not used by this project. Verify by grepping the
  codebase for imports of the affected package and checking if the vulnerable API surface is called.
- `inert` — development-only dependency (scope: "development") that does not affect production builds
  or runtime.
- `tolerable_risk` — low severity (CVSS < 4.0), no known exploit, and no patched version available yet.
- `no_bandwidth` — do NOT use this reason autonomously. Only suggest if the user explicitly asks to
  defer.

### Code scanning alerts

**Fix when:**
- Severity is error or warning with security implications
- The flagged code is in production paths (not test files, not generated code)
- The rule identifies a real pattern (SQL injection, XSS, path traversal, etc.)

**Dismiss candidates:**
- `false positive` — the tool flagged something that is not actually vulnerable when you read the code
  context.
- `used in tests` — the alert is in a test file and the pattern is intentional.
- `won't fix` — the code is in a deprecated path scheduled for removal, or the risk is accepted.

**Codebase verification required:** read the flagged file and line before categorizing. Do not dismiss
based on rule description alone.

### Secret scanning alerts

**Fix when:**
- The secret appears to be a real, active credential
- The secret type is a high-value target (API keys, tokens, passwords, private keys)

**Dismiss candidates:**
- `revoked` — the secret has already been rotated/revoked (must confirm with user).
- `false_positive` — the detected string is not actually a secret (placeholder, example value, hash).
- `used_in_tests` — test fixture, not a real credential.
- `wont_fix` — do NOT use autonomously. Only if the user explicitly accepts the risk.

**Secret scanning always requires user confirmation before dismissal.** Never auto-dismiss a secret
scanning alert.

**Default to fix when uncertain.** False negatives (missing a real vulnerability) are worse than false
positives (creating an unnecessary issue).

## Dismiss API calls (after user approval, Step 7)

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

Note: secret scanning uses `state=resolved` and `resolution` (not `state=dismissed` and
`dismissed_reason`) — using the wrong pair for the wrong alert type causes an API error.
