// Fictional "Acme Renewals" demo config — a made-up admin app used to illustrate the skill.
// Brand colours here are placeholders: in a real run, pick them via the artifact branding decision
// (match the project's directory to its brand-guidelines skill and use that skill's primary colour).
export const CFG = {
  brandName: 'Acme · Renewals',
  accent: '#2D6CDF',
  accentDeep: '#1E4FA8',
  cardBg: '#2D6CDF',
  cardText: '#ffffff',
  cursor: '#CC4141',     // SSW red
  annotate: '#CC4141',   // SSW red
  presenter: 'User',
  env: 'local environment',
  date: '1 January 2026',  // set per recording
};

export const APP_URL = 'https://localhost:5005';
// Seeded local dev user. If the demo env needs no sign-in, drop LOGIN and just navigate.
export const LOGIN = { url: APP_URL, user: 'demo', pass: 'demo-password' };
