// Acme Renewals V2: take a renewal through the approval lifecycle (Draft → In Review → Approved).
// A fresh renewal starts as Draft and only becomes approvable after its checklist is generated and an
// owner is assigned — those happen OFF CAMERA (see README + trigger.mjs), and MUST be listed on the
// "behind the scenes" interstitial in build-approve.mjs. Set ID + OUT before running.
import { launch, login, pause, moveClick, park, setStep, shot, finish } from '../../scripts/studio.mjs';
import { CFG, APP_URL, LOGIN } from './config.mjs';
import fs from 'node:fs';
const OUT = './vid';
const SHOTS = `${OUT}/shots`;
fs.mkdirSync(SHOTS, { recursive: true });
const HOLD = 2800;
const ID = 'REPLACE-WITH-PREPARED-RENEWAL-ID';
const RENEWAL = `${APP_URL}/renewals/${ID}`;
const { browser, context, page } = await launch(OUT, CFG);

// Each step re-opens the renewal (a full reload) and re-sets the lower-third (the overlay resets on nav).
async function open(step, t, s) { await page.goto(RENEWAL, { waitUntil: 'domcontentloaded' }); await pause(page, 3000); await setStep(page, step, t, s); await park(page, 700, 250); await pause(page, 800); }
async function act(label) { await moveClick(page, page.locator(`button:has-text("${label}")`).first(), { post: 1000 }); await moveClick(page, page.locator('button:has-text("Confirm")').first(), { post: 1500 }); }

try {
  await login(page, LOGIN);
  await open(1, 'Open the renewal', 'It starts in Draft, ready to work');
  await open(2, 'Submit for review', 'Moves the renewal into In Review'); await act('Submit for review');
  await open(3, 'Approve', 'The final approval marks it Approved'); await act('Approve');

  await page.goto(`${APP_URL}/accounts`, { waitUntil: 'domcontentloaded' });
  await pause(page, 2000); await setStep(page, 4, 'Approved', 'The list shows it approved'); await park(page);
  await moveClick(page, page.locator('[aria-label="Expand"]').first(), { post: 1200 });
  await park(page, 600, 320);
  // NEW: the freshly approved period in the list — longer hold with the annotation on screen.
  await shot(page, `${SHOTS}/approved.png`, { highlight: page.locator('text=Approved').first(), settle: HOLD });

  console.log('VIDEO:', await finish(context, browser, OUT, 'rec-approve.webm'));
} catch (e) {
  console.error('REC ERROR', e.message, e.stack);
  try { await context.close(); await browser.close(); } catch {}
  process.exit(1);
}
