// Copy this to your demo's working dir as `config.mjs`, fill in the brand + app values, and import
// it from your video/build scripts. The CORE scripts (studio/cards/assemble) take this CFG as input
// and carry nothing app-specific themselves.

// --- Brand colours -----------------------------------------------------------------------------
// Pick the brand colours via the `brand-guidelines` skill (see its `references/routing.md`), which
// resolves the right brand from the project's directory and context, then use that brand's primary
// colour for `accent`/`cardBg` and its text colour for `cardText`. The cursor + annotation boxes are
// ALWAYS SSW red (#CC4141) — every brand, including the personal one. A consistent red pointer reads
// clearly on any UI and is never mistaken for the product's own accent.
// The values below are placeholders for a fictional app — replace them per the decision above.
export const CFG = {
  brandName: 'Acme · Renewals',     // kicker text on the cover
  accent: '#2D6CDF',                // brand accent — cards + lower-third
  accentDeep: '#1E4FA8',
  cardBg: '#2D6CDF',                // full-bleed card background
  cardText: '#ffffff',
  cursor: '#CC4141',                // SSW red
  annotate: '#CC4141',              // SSW red — shot() annotation boxes
  presenter: 'User',      // footer, bottom-left
  env: 'local environment',         // footer centre → "Demo · {env}"
  date: '1 January 2026',           // footer, bottom-right (set per recording)
};

// --- App entry points (example values; replace per app) ----------------------------------------
export const APP_URL = 'https://localhost:5005';
export const LOGIN = { url: APP_URL, user: 'demo', pass: 'demo-password' };  // passed to studio login(); omit if no auth
