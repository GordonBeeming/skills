# Cards

`scripts/cards.mjs` generates full-screen 1920×1080 cards as HTML and screenshots them to PNG (this
ffmpeg build has no `drawtext`/freetype, so all on-video text must arrive as images). Every card shares
a footer: presenter (left) · `Demo · {env}` (centre) · date (right).

## Types

- `cover(cfg, { title, subtitle })` — opening card. `brandName` kicker, big title, subtitle. `title`
  may contain `<br/>`.
- `agenda(cfg, { intro, steps })` — the **"In this video"** card. `intro` is the optional subtext blurb
  (smaller font, under the heading, before the steps) — one or two plain sentences on *what was built*
  and *what this video demonstrates*. `steps` is `[{ t, sub? }]`; rendered as a numbered list. Omit
  `intro` for no blurb.
- `interstitial(cfg, { header, desc, steps })` — a "freeze" card before off-camera setup. **MANDATORY whenever
  state changes off-camera** (background jobs, DB nudges, data prep, role assignment, anything you did by hand
  between recorded beats). Without it the viewer sees a record jump from one state to another — e.g. a record
  go from *Draft* to *Ready / approvable* — with no explanation of how. Enumerate **each** off-camera step as
  its own list item (with a `sub` line saying why/what), titled "Behind the scenes", placed in the timeline
  right before the recorded section that depends on that setup. The example's approve build is the model
  (`examples/acme-renewals/build-approve.mjs`): mark received → run the generate job → assign the owner. If you
  did off-camera work and there's no interstitial for it, the video is incomplete — add the card and rebuild.
- `end(cfg, { title, steps })` — closing recap (title + "Recap — what we did" + the step list).

`renderCards(cards, outDir)` takes `[{ name, html }]`, writes each HTML + screenshots it to
`outDir/<name>.png`, and returns the PNG paths.

## The agenda blurb (why it matters)

The video is silent, so the steps alone say *what* will happen but not *why it exists*. The blurb gives
the one-breath framing: "we built X; this video shows Y (e.g. both ways to trigger it)". Keep it to one
or two sentences, present tense, User's voice — and run it through the humanizer with the rest of the
prose.

## Brand colours

- `cardBg` / `accent` — the brand accent. Resolved by the `brand-guidelines` skill (see its
  `references/routing.md`) and pulled from that brand's primary colour. The lower-third in `studio.mjs` uses
  the same `accent`.
- The cursor + annotation use SSW red `#CC4141` (see `config.example.mjs` for the full rule).
- Card text is white on the accent background; keep contrast AA — if a brand accent is light, darken the
  card background or switch text to a dark colour.
