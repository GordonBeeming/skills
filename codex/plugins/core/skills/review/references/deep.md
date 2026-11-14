# Deep review

One thorough reviewer uses the shared review-common.md procedure over the entire PR and both
base and head snapshots. Trace changed behaviour through callers, state transitions, persistence,
error and cancellation paths. Reassess every relevant previous finding and reply. Check contracts,
security, concurrency, resource cost and the tests that exercise the changed paths. Verify each
finding against reachable code before ranking. Record every changed path in coverage; generated
or vendored noise can be identified, never silently omitted. This mode may approve when coverage
is complete. Deep does not launch the Ultra panel.
