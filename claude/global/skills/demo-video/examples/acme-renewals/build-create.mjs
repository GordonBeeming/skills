// Build Acme Renewals V1: cover → agenda(+blurb) → recording → end recap. No off-camera setup here, so no
// interstitial. Run after record-create.mjs.
import { CFG } from './config.mjs';
import * as C from '../../scripts/cards.mjs';
import { imageClip, videoClip, concat } from '../../scripts/assemble.mjs';
const D = './vid';

const steps = [
  { t: 'Open the accounts list' },
  { t: "Open an account's renewals" },
  { t: 'Create the next period inline' },
  { t: 'Bulk-create the next period' },
  { t: 'See the new period in the list' },
];

await C.renderCards([
  { name: 'v1-cover', html: C.cover(CFG, { title: 'Renewals<br/>Create Next Period', subtitle: 'Roll an account forward — inline or in bulk' }) },
  { name: 'v1-agenda', html: C.agenda(CFG, { intro: "We've added a way to roll an account to its next renewal period straight from the list — one account at a time, or in bulk. This video walks through both.", steps }) },
  { name: 'v1-end', html: C.end(CFG, { title: 'Renewals — Create Next Period', steps }) },
], D);

imageClip(`${D}/v1-cover.png`, 4, `${D}/s1.mp4`);
imageClip(`${D}/v1-agenda.png`, 7.5, `${D}/s2.mp4`);
videoClip(`${D}/rec-create.webm`, `${D}/s3.mp4`);   // real-time — see assembly.md on the webm-duration warning
imageClip(`${D}/v1-end.png`, 7, `${D}/s4.mp4`);
concat([`${D}/s1.mp4`, `${D}/s2.mp4`, `${D}/s3.mp4`, `${D}/s4.mp4`], `${D}/renewals-create.mp4`);
console.log('built renewals-create');
