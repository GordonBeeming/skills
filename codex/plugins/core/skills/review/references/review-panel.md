# Shared Ultra seat briefs

### bugs

One question: for every input this code can actually receive, does it return the right answer,
throw, or leak? The honest, non-adversarial lens. Look for:

- Off-by-one, inverted conditions, precedence slips, boundary inputs (empty, zero, negative, single
  element, maximum, duplicates, first and last iteration), wrong return values, missing returns.
- Null, None, undefined, absent used unchecked; absent, empty, and zero collapsed into one branch;
  a `?? default` that hides a missing value.
- Unhandled error arms, missing `await`, swallowed exceptions that let execution continue on bad
  state, resources opened on a path that can throw before release.
- Invariants the base code upheld that the change breaks: fields kept in sync, caches invalidated,
  counters matching collections. Overflow, float money, truncating division, timezone maths.
- Concurrency: unsynchronised shared state, check-then-act windows, locks held across `await`,
  async-over-sync blocking, fire-and-forget that loses errors, cancellation not propagated,
  unbounded fan-out.
- Data integrity: migrations with no down or with table locks on hot tables, constraints that fail
  on existing rows, enum renumbering on persisted values, non-idempotent backfills, precision or
  timezone loss on stored values.
- Wire contracts: removed, renamed, or retyped fields on a shipped shape, changed status codes,
  tightened validation, producer and consumer drift.

Do not flag: attacker-steered input (security), missing logs (sre), style (conventions), missing
tests (tests). Severity: Blocker for a wrong result or crash on a path real users hit; High for a
genuine bug on a plausible input; Medium for a narrow edge or missing guard where nothing upstream
guarantees the input; Low for fragility that works today by luck. Give the specific input that
breaks it.

### security

An authorised, defensive review of User's own code. Reason about a deliberate attacker. Look for:

- Injection: SQL, command, template, path traversal, from any value that came from a request,
  header, file, or third-party response.
- AuthN and AuthZ: sensitive operations with no authentication, authenticated but never checked for
  the specific resource (IDOR), checks in the UI only, over-broad scopes.
- Secrets in code or logs; PII in responses, URLs, or log lines beyond what the caller needs.
- Untrusted input crossing a trust boundary unvalidated; unsafe deserialisation; SSRF with no
  allow-list; no rate limit on login, reset, token, or expensive endpoints.
- Weak crypto: MD5 or SHA1 for passwords, static IVs, `Math.random` for tokens, hand-rolled
  primitives.
- Dependency usage that reaches a known-vulnerable code path in a package the diff adds or bumps.

Trace the value to its source before calling it untrusted; a middleware may already sanitise it. Do
not flag honest-input logic bugs (bugs) or log volume (sre). Severity: Blocker for a directly
exploitable hole on a reachable path; High for a real hole behind a plausible precondition; Medium
for a missing defence-in-depth control; Low for hardening nits. Name the trust boundary crossed and
what an attacker gains.

### sre

The on-call lens: when this breaks in production, can the paged engineer diagnose it from logs,
metrics, and traces, and can they stop it? Look for:

- Silent failure points: a catch with no log, a degraded path or fallback that leaves no trace.
- Wrong levels: a real failure at Info or Debug, per-request chatter at Warning or Error, an
  exception logged without the exception object.
- The trace rule from the code-quality rules: "trace logging" is the literal trace level, never
  Info standing in for it, and a diff that bumps Trace or Debug up to Info to see it locally is a
  finding; the fix is the dev-config filter.
- No correlation or trace id across a multi-step flow; no metric on a payment, write, migration, or
  consumer; a new worker or dependency with no health signal.
- External calls with no timeout, no retry with backoff, no breaker; caches, queues, and buffers
  with no cap; queries with no limit; loops with no ceiling.
- Error messages with none of the identifiers needed to act.

Match the file's existing logging pattern; do not invent a new one. Do not flag whether the error
is correctly handled (bugs), a secret in a log (security), or the repo's logging helper
(conventions). Severity: Blocker for a critical path that can fail with zero trace or hang the
service; High for a silent catch on an important path or a real failure that will not alert;
Medium for missing correlation or a slightly wrong level; Low for a thin message. State the 3am
impact.

### conventions

Does this change match how this repo does things: its written rules, its formatting, the idioms in
neighbouring code? Look for:

- Rule-file adherence: open every `CLAUDE.md` and `AGENTS.md` in `context.md` and anything they
  import. For any finding drawn from one, quote the exact rule and its file; without the quote it is
  an opinion and step 4 drops it. Respect in-code opt-outs.
- Formatting and layout the configured formatter would reject; import ordering; a file in the wrong
  folder or with the wrong casing; a test not in the mirrored location.
- Hand-rolling something the codebase already has a helper for; a handler or component structured
  unlike its siblings for no reason; a lint rule the repo enables, violated.
- Code hygiene, from the code-quality rules: comments that restate the line or narrate the change
  that produced it; issue and PR numbers sprinkled into ordinary comments; the dated `NOTE:` form
  used for anything short of a real decision; a missing comment on a genuinely non-obvious
  invariant; abbreviations where a full word reads better; cleverness a plain form would beat.
- Manifest hygiene: a dependency added for something the standard library or an existing package
  already does, a loosened pin, a manifest change with no lockfile change, a major bump with no
  migration in the diff.

A convention is only a convention if the rest of the repo follows it; confirm the pattern in
neighbouring files first. Do not flag correctness, security, logging levels, or missing tests.
Severity: Blocker for a hard "never" or "always" rule broken, or a CI lint gate that will fail;
High for a documented convention or strongly established pattern ignored; Medium for inconsistency
with an obvious repeated idiom; Low for formatter-level nits.

### cost

What does this change cost every time it runs, in production and in the test suite? Trace each new
path to where it runs and how often. Look for:

- Background work: a new job, message, or event handler. When it fails, what happens: retries,
  backoff delays, rescheduling. Then open the test double that runs it (a test job manager, fake
  bus, in-memory queue) even if the diff does not touch it: does it block until the work completes,
  with what timeout, and what does a job that retries or reschedules do to that wait? Work that never
  reaches a final state in tests costs the full timeout in every test that triggers it.
- Waits: sleeps, polling loops, timeouts, retry policies, and delays on a request path or in a test
  fixture; any wait whose worst case has become the common case.
- I/O in loops: N+1 queries, a call per item, missing batching or paging, a query filtering on a
  column with no index.
- Startup and per-request cost: work moved into startup, middleware, or a hot path; something heavy
  resolved or built per request; large objects serialised on every call.
- Unbounded growth: collections, caches, tables, or queues with no cap or retention.

Do not flag missing logs (sre) or wrong results (bugs). Severity: High for a cost every request, or
every test in a suite, pays (minutes added to a suite, a timeout hit on a common path); Medium for a
cost on a secondary path, or a wait a handful of tests pay; Low for a micro-optimisation. State the
estimate: how often it runs times what each run costs.

### tests

Not the bug itself; the missing or weakened test that would have caught it. Look for:

- New behaviour with nothing exercising it; changed behaviour whose tests were not updated.
- A test deleted, skipped, commented out, or loosened so the change passes. This is Blocker on its
  own; name the coverage lost.
- Assertions that assert nothing; a unit so mocked that no real logic runs; happy path only, no
  null, empty, boundary, or error branch.
- Flaky patterns: wall clock, sleeps, unordered collections, real network, shared state.
- Tests coupled to private internals or exact call sequences; hard-coded dates, paths, and ports.

Find the real test file and read what it asserts before calling a gap; a table-driven test two
files over may already cover it. Severity: Blocker for a weakened test hiding lost coverage; High
for a critical path with new behaviour and no test; Medium for a secondary path or missing edge;
Low for one weak assertion. State the specific test to add and what it asserts.
