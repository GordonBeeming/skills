// Full-screen (1920x1080) card generator + PNG renderer: cover, agenda ("In this video"),
// interstitial ("behind the scenes"), and end (recap). Cards are rendered as HTML then screenshot
// to PNG — this ffmpeg build has no drawtext/freetype, so text-on-video has to come in as images.
// Playwright is loaded via createRequire because it ships CommonJS. Resolve it plainly first — this
// finds a global install on NODE_PATH (a shunt guest bakes one in) with no machine-specific path —
// and fall back to a fixed host install location only if that fails.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/Users/user/node_modules/playwright'));
}
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const base = (cfg, inner) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;}
html,body{width:1920px;height:1080px;background:${cfg.cardBg};color:${cfg.cardText};font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;}
.page{position:relative;width:100%;height:100%;padding:120px 150px 150px;display:flex;flex-direction:column;}
.kicker{font-size:26px;letter-spacing:.24em;text-transform:uppercase;opacity:.82;}
.title{font-size:84px;font-weight:750;line-height:1.05;margin-top:14px;}
.subtitle{font-size:40px;opacity:.95;margin-top:22px;font-weight:400;}
.h{font-size:62px;font-weight:750;}
.desc{font-size:30px;opacity:.9;margin-top:18px;max-width:46ch;line-height:1.4;}
ol{margin-top:40px;padding:0;list-style:none;counter-reset:s;display:flex;flex-direction:column;gap:20px;}
ol li{counter-increment:s;display:flex;align-items:flex-start;gap:24px;font-size:36px;line-height:1.25;}
ol li::before{content:counter(s);flex:0 0 auto;width:54px;height:54px;margin-top:-4.5px;border-radius:50%;background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;}
ol li .sub{display:block;font-size:24px;opacity:.78;margin-top:4px;}
.center{flex:1;display:flex;flex-direction:column;justify-content:center;}
.footer{position:absolute;left:150px;right:150px;bottom:70px;display:flex;align-items:center;justify-content:space-between;font-size:24px;opacity:.85;}
.footer .mid{opacity:.9;}
</style></head><body><div class="page">${inner}
<div class="footer"><div>${cfg.presenter}</div><div class="mid">Demo · ${cfg.env}</div><div>${cfg.date}</div></div>
</div></body></html>`;

const liList = (steps) => `<ol>${steps.map(s => `<li><div>${s.t}${s.sub ? `<span class="sub">${s.sub}</span>` : ''}</div></li>`).join('')}</ol>`;

export const cover = (cfg, { title, subtitle }) => base(cfg, `<div class="center"><div class="kicker">${cfg.brandName}</div><div class="title">${title}</div><div class="subtitle">${subtitle}</div></div>`);
// agenda: optional `intro` blurb (smaller font) under the heading — say what was built and what the
// video demonstrates in plain language — then the step list.
export const agenda = (cfg, { intro, steps }) => base(cfg, `<div class="h">In this video</div>${intro ? `<div class="desc">${intro}</div>` : ''}${liList(steps)}`);
export const interstitial = (cfg, { header, desc, steps }) => base(cfg, `<div class="h">${header}</div><div class="desc">${desc}</div>${liList(steps)}`);
export const end = (cfg, { title, steps }) => base(cfg, `<div class="h" style="margin-bottom:10px">${title}</div><div class="kicker" style="margin-bottom:18px">Recap — what we did</div>${liList(steps)}`);

// Render an array of {name, html} to PNG files in outDir; returns paths.
export async function renderCards(cards, outDir) {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const out = [];
  for (const c of cards) {
    const htmlPath = `${outDir}/${c.name}.html`; const pngPath = `${outDir}/${c.name}.png`;
    fs.writeFileSync(htmlPath, c.html);
    // Resolve to an absolute file:// URL — a relative outDir (e.g. './vid') yields the invalid
    // `file://./vid/…` and Playwright fails to navigate.
    await p.goto(pathToFileURL(htmlPath).href); await p.waitForTimeout(250);
    await p.screenshot({ path: pngPath });
    out.push(pngPath);
  }
  await b.close();
  return out;
}
