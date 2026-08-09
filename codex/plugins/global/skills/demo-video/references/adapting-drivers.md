# Adapting to other drivers (e.g. MCP-driven desktop / Tauri apps)

This skill is built around Playwright driving a **web** UI in a real browser. The design splits cleanly
into two layers, which is what makes other targets feasible:

- **Driver (Playwright-specific):** navigation (`page.goto`), input (`page.mouse.move/click`,
  `page.fill`), screenshots (`page.screenshot`), and screen capture (`recordVideo`). Also the DOM-injected
  overlays (cursor + lower-third via `addInitScript`) — these rely on injecting into the page.
- **Presentation (reusable anywhere):** `cards.mjs` (cover/agenda/interstitial/end), `assemble.mjs`
  (ffmpeg stitching + quality settings), the QA loops, and the HTML artifact. None of it cares how the
  frames were produced.

## A Tauri app driven by an MCP

If the app is a Tauri (or other desktop) app with an MCP that drives it, only the **driver** layer
changes:

- **Driving** — the MCP issues the clicks/navigation instead of `page.mouse`/`page.goto`.
- **Capture** — there's no `recordVideo`. You'd capture the window via the OS (e.g. an `ffmpeg`
  screen/window grab, or the platform's screen-record API) and capture stills via the app's own
  screenshot or an OS screenshot.
- **Overlays** — the DOM-injected cursor + lower-third won't work (no page to inject into). Options:
  composite the lower-third/cursor in post (overlay PNGs onto the captured video with ffmpeg at known
  timestamps), or render the lower-third as full cards between beats instead of a persistent strip.
- **Annotations** — `shot()`'s DOM box won't apply; draw the call-out box in post on the captured still
  (ffmpeg/imagemagick) at the element's coordinates, or rely on cards.

## Recommendation

This is best as a **sibling skill** (e.g. `demo-desktop-app-feature`) that **reuses `cards.mjs` and
`assemble.mjs` verbatim** and swaps in an MCP-driven recorder + an OS-capture path, rather than bolting a
second driver into this one. The cards/assembly/QA/artifact docs here apply unchanged. Decide the exact
shape when we actually try it against a real Tauri+MCP app — the unknowns are how clean the OS capture is
and whether post-composited overlays look as good as the injected ones.
