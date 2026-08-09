# Example: Acme Renewals (fictional)

A made-up "Renewals" admin app, used to show the shape of a two-video demo end to end. Nothing here is a
real product — the flows, selectors, URLs, and job names are invented. Copy the *shape*, not the specifics.

## The two videos

- **Create — `record-create.mjs` / `build-create.mjs`:** from the accounts list, expand an account, create
  its next renewal period inline, then bulk-create the period for every eligible account, then see the new
  period in the list. Annotations only on the things the feature *creates* (the new Draft period; the bulk
  "Created N" result). No off-camera setup → no interstitial.
- **Approve — `record-approve.mjs` / `build-approve.mjs`:** take a renewal through Draft → In Review →
  Approved and show it approved in the list. A fresh renewal isn't approvable until its checklist is
  generated and an owner is assigned — those are done **off camera**, so this build includes a "Behind the
  scenes" interstitial listing them.

## Off-camera prep (mirrored on the interstitial)

To make the renewal approvable on camera, stage it by hand (see `app-state-setup.md` for the principle):
1. Mark the renewal received.
2. Run the generate job (`node trigger.mjs generate-checklist`) so the checklist is built → Ready.
3. Assign the owner so the approve controls show for the demo user.

Each of these is a line on the interstitial in `build-approve.mjs` — if you do off-camera work and it's not
on the card, the video is incomplete.

## Run order

1. (If re-recording) reset any created test data so you start clean.
2. `node record-create.mjs` → `node build-create.mjs`.
3. Stage the prep above; put the renewal's id into `record-approve.mjs` (`const ID`).
4. `node record-approve.mjs` → `node build-approve.mjs`.
5. Posters + copy to the artifact + QA (see the main workflow + `qa-loops.md`).

## Config

`config.mjs` holds the brand CFG (placeholder accent — pick the real one via the branding decision), the app
URL, and the seeded `LOGIN`. Set `OUT` and `CFG.date` per run.
