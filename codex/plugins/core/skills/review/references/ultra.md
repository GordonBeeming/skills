# Ultra review

Explicit invocation only. Never select Ultra through auto, risk, size, follow-ups or retries.
Run the six independent seats in panel.md, then one verification pass against the actual code.
Every required seat must complete. Preserve every candidate in the audit report; verify and
merge duplicates, and distinguish confirmed findings from filtered or unverified candidates.
A missing seat or verifier is an incomplete Ultra review, never a silent downgrade to Deep.
Use the heading `## Ultra review report`. Include the resulting report in the PR comment/review body, with per-seat coverage, final findings,
verification caveats and the disposition of panel candidates. A link alone is insufficient.
Respect the caller's publication permission: a preview produces a local report and never posts.

## Verification confidence

Use ultraConfidenceMinimum in review-contract.json as the confirmation threshold (currently 80).
Score factual confidence, not importance: a verified Low finding can score 100. Zero means a
false positive or pre-existing unrelated issue; 25 means a plausible claim with little evidence;
50 means material evidence remains missing; 75 means strong evidence with uncertain reachability;
100 means the code confirms the defect on a reachable path. Confirm only at or above the threshold.
Keep filtered and unverified candidates in the report with their score and reason. Unverified
claims stay caveats; they must not silently become confirmed findings.
