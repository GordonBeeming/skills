// Stand-in for kicking a background job on demand so a record reaches the right state without waiting for a
// cron/queue (fictional). Many apps gate the trigger POST behind an anti-forgery token — read it from the
// page's meta tags and send it as the expected header from inside a logged-in browser context. Adapt the
// route, field name, and token header to the real app. Usage: node trigger.mjs <jobId>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/user/node_modules/playwright');
import { APP_URL, LOGIN } from './config.mjs';

const jobs = process.argv.slice(2);
if (!jobs.length) { console.error('usage: node trigger.mjs <jobId> [jobId...]'); process.exit(1); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();

// Sign in so the trigger call carries the session + anti-forgery cookie.
await page.goto(LOGIN.url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type=password]', { timeout: 30000 });
await page.fill('input[name="username"]', LOGIN.user).catch(() => {});
await page.fill('input[type=password]', LOGIN.pass);
await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}), page.click('button:has-text("Sign in")')]);
await page.waitForTimeout(3000);

await page.goto(`${APP_URL}/admin/jobs`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

for (const job of jobs) {
  const status = await page.evaluate(async (jobId) => {
    const hdr = document.querySelector('meta[name="csrf-header"]')?.content || 'RequestVerificationToken';
    const tok = document.querySelector('meta[name="csrf-token"]')?.content || '';
    const headers = { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' };
    headers[hdr] = tok;
    const body = new URLSearchParams(); body.append('jobs[]', jobId);
    const r = await fetch('/admin/jobs/trigger', { method: 'POST', headers, body, credentials: 'same-origin' });
    return r.status;
  }, job);
  console.log('TRIGGER', job, '->', status);
}

await ctx.close(); await browser.close();
