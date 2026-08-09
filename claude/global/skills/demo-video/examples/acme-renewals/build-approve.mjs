// Build Acme Renewals V2: cover → agenda(+blurb) → "Behind the scenes" interstitial → recording → end recap.
// The interstitial is REQUIRED here because state was changed off-camera to make the renewal approvable
// (see record-approve.mjs + README). Each off-camera step is its own line so the viewer sees how the
// renewal went from Draft to approvable. Run after record-approve.mjs.
import { CFG } from './config.mjs';
import * as C from '../../scripts/cards.mjs';
import { imageClip, videoClip, concat } from '../../scripts/assemble.mjs';
const D = './vid';

const steps = [
  { t: 'Open the renewal' },
  { t: 'Submit for review' },
  { t: 'Approve' },
  { t: 'Approved — shown in the list' },
];

// The off-camera setup, enumerated — this is what build-create.mjs does NOT need (it has no off-camera prep).
const bg = [
  { t: 'Mark the renewal "received"', sub: 'Normally set when the client submits' },
  { t: 'Run the generate job', sub: 'Builds the checklist from the template → Ready' },
  { t: 'Assign the owner', sub: 'So the approve controls are available to the demo user' },
];

await C.renderCards([
  { name: 'v2-cover', html: C.cover(CFG, { title: 'Renewals<br/>Approval Lifecycle', subtitle: 'From Draft to Approved — in the UI' }) },
  { name: 'v2-agenda', html: C.agenda(CFG, { intro: 'Once a renewal exists it runs through the normal approval lifecycle. Here I take one all the way from Draft to Approved.', steps }) },
  { name: 'v2-inter', html: C.interstitial(CFG, { header: 'Behind the scenes', desc: 'Getting a fresh renewal ready normally happens automatically when it is received. Here those steps are triggered by hand so the approval can run on camera:', steps: bg }) },
  { name: 'v2-end', html: C.end(CFG, { title: 'Renewals — Approval Lifecycle', steps }) },
], D);

imageClip(`${D}/v2-cover.png`, 4, `${D}/t1.mp4`);
imageClip(`${D}/v2-agenda.png`, 7.5, `${D}/t2.mp4`);
imageClip(`${D}/v2-inter.png`, 9, `${D}/t3.mp4`);   // <-- the interstitial, in the concat (don't forget this)
videoClip(`${D}/rec-approve.webm`, `${D}/t4.mp4`);
imageClip(`${D}/v2-end.png`, 7, `${D}/t5.mp4`);
concat([`${D}/t1.mp4`, `${D}/t2.mp4`, `${D}/t3.mp4`, `${D}/t4.mp4`, `${D}/t5.mp4`], `${D}/renewals-approve.mp4`);
console.log('built renewals-approve');
