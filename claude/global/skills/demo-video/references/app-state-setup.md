# App state setup

A demo needs the app in a precise, known state — a record at the right stage, a list with the right rows,
a prerequisite already completed. The principle is **script the setup so it's reproducible**, because
you'll re-run it every time you re-record (a flow that creates data consumes the clean state). How you
achieve the state is entirely app-specific; figure it out per project (read the repo, ask the user). The
fictional example below shows the *kind* of moves involved — none of it is part of the core skill.

## General shape

1. **Identify the exact entities** the flow touches and the state each must be in.
2. **Write a reset** that returns those entities to the pre-demo state (so take 2 starts clean).
3. **Drive any background pipeline deterministically** rather than waiting on a cron/queue.
4. **Assign whatever the UI gates on** (roles, permissions, ownership) so the on-camera actions are allowed.
5. **Mirror every off-camera step on a "behind the scenes" interstitial** so the viewer sees how state changed.

---

## Worked example (fictional "Renewals" app — illustrative, not portable)

Say the demo signs off a *renewal*, but a fresh renewal starts as **Draft** and only becomes signable once
its checklist is generated (normally an automatic background job) and an owner is assigned. To run that on
camera you stage it by hand — and each of these becomes a line on the interstitial:

### Triggering a background job on demand

If readiness depends on a queued/cron job, trigger it directly instead of waiting. A common shape is an admin
"jobs" endpoint or dashboard whose trigger POST is CSRF-protected: read the page's anti-forgery token from its
meta tags and send it as the expected header from inside a logged-in browser context (`credentials:
same-origin`). Confirm by the response status and by re-reading the record's state. `examples/acme-renewals/
trigger.mjs` is a stand-in for this; adapt it to the real app's job mechanism.

### Resetting created data between takes

A "create" flow consumes the clean state, so a second take needs the created rows removed first. Script the
reset (delete the test rows you created, in FK-child-before-parent order) and **only delete test data you made
for the demo** — confirm before touching anything richer. If the tables are audited/versioned, prefer plain
`DELETE`/`UPDATE` over disabling versioning so history stays intact.

### Prepare + assign sequence (get a record into an actionable state)

A typical sequence: `UPDATE` the record to the precursor state the next step expects → trigger the background
job that builds out its child data and moves it to the actionable state → set the owner/assignee fields the
action's UI gates on. Use whatever DB/CLI access the dev environment provides; keep each nudge minimal and
reversible by the reset above.

## Reset hygiene — clear ALL consumed state between takes

A re-record must start from an identical clean baseline, or leftovers from earlier takes leak in (the
classic: an upload that appends `file (1).pdf`, `file (2).pdf` so the demo shows 3 files when you uploaded
one; or a "create" that silently skips because a prior run already marked the external system as done).
The reset script must clear **every** layer the flow touched:
- DB rows + mappings for the record (and its child rows / temporal children).
- Any **external/integration** flags the flow flipped (e.g. a status on a shared upstream system).
- **Files on disk / shares** the flow wrote (uploads can land on a file-share path, and a later processing
  step may import them — so leftover files multiply). Delete them.
Keep the whole thing in one `full-reset.sh` so re-records are one command.

## Mirror the app when staging data

If you set state straight in the DB, set **every field the real action sets**, not just the headline
status — e.g. an "approved" record needs the approver id + a timestamp, or the UI shows the badge with a
blank "approved by …" line and looks broken. After staging, open the actual screen and confirm it renders
identically to a genuinely-actioned record.
