// Acme Renewals V1: from the accounts list, create an account's next renewal period inline, then in bulk,
// then see the new period appear. Illustrative — selectors are fictional; adapt to the real app.
// Pacing: routine pre-existing clicks get short beats; the "new thing our code created" beats get a longer
// annotated HOLD (shot()'s settle keeps the box on screen). Set OUT before running.
import { launch, login, pause, moveClick, park, setStep, shot, finish } from '../../scripts/studio.mjs';
import { CFG, APP_URL, LOGIN } from './config.mjs';
import fs from 'node:fs';
const OUT = './vid';
const SHOTS = `${OUT}/shots`;
fs.mkdirSync(SHOTS, { recursive: true });
const HOLD = 2800;
const { browser, context, page } = await launch(OUT, CFG);

try {
  await login(page, LOGIN);
  await page.goto(`${APP_URL}/accounts`, { waitUntil: 'domcontentloaded' });
  await pause(page, 2000); await park(page);
  await setStep(page, 1, 'Open the accounts list', 'Each account shows its renewal history'); await pause(page, 900);

  await setStep(page, 2, "Open an account's renewals", 'Expand to see every period');
  await moveClick(page, page.locator('[aria-label="Expand"]').first(), { post: 1200 });
  // Context shot (nothing created yet) — no annotation.
  await shot(page, `${SHOTS}/list-expanded.png`);

  // Inline create — the one creatable period for this account
  await setStep(page, 3, 'Create the next period — inline', 'One click on the account');
  await moveClick(page, page.locator('text=Create next period').first(), { post: 700 });
  await pause(page, 700);
  await moveClick(page, page.getByRole('button', { name: 'Create', exact: true }), { post: 1200 });
  // NEW: the just-created period — longer hold with the annotation on screen.
  await shot(page, `${SHOTS}/inline-created.png`, { highlight: page.locator('text=Draft').first(), settle: HOLD });

  // Bulk create — the same period for every eligible account
  await setStep(page, 4, 'Bulk-create the next period', 'Pick the period and see the live count');
  await moveClick(page, page.locator('button:has-text("Create next period")').first(), { post: 900 });
  await pause(page, 1000);
  // Context shot — the pre-create count preview (not created yet), no annotation.
  await shot(page, `${SHOTS}/bulk-dialog.png`);
  await moveClick(page, page.locator('button:has-text("Create")').first(), { post: 1500 });
  // NEW: the run created the periods — longer hold with the annotation on screen.
  await shot(page, `${SHOTS}/bulk-done.png`, { highlight: page.getByText(/Created \d+/i).first(), settle: HOLD });
  await moveClick(page, page.locator('button:has-text("Done")').first(), { post: 800 });

  await setStep(page, 5, 'See the new period in the list', 'The created period appears as Draft');
  await park(page, 640, 320); await pause(page, 1600);

  console.log('VIDEO:', await finish(context, browser, OUT, 'rec-create.webm'));
} catch (e) {
  console.error('REC ERROR', e.message, e.stack);
  try { await context.close(); await browser.close(); } catch {}
  process.exit(1);
}
