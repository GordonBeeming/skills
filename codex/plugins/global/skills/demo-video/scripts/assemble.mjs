// ffmpeg assembler: render card stills + recording into a single mp4 (cards → recording → end).
//
// Quality matters here: screen text on a static-ish background needs a low CRF or it smears into
// the artifacting User flagged. CRF 14 on the near-lossless intermediates keeps generational loss
// across the speed/concat passes invisible; CRF 16 + preset slow on the final concat is the
// visible-quality pass. setsar=1 + -aspect 16:9 stops players opening the file at the wrong size.
import { execSync } from 'node:child_process';

const sh = (c) => execSync(c, { stdio: ['ignore', 'ignore', 'inherit'] });

const VENC = '-c:v libx264 -preset slow -crf 14 -x264-params keyint=60';
// Final pass at CRF 14 too (was 16): screen text is unforgiving, and matching the intermediates means the
// final concat adds no generational softening. Output stays 1920x1080, SAR 1:1, -aspect 16:9.
const FENC = '-c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p';

// Probe a recording's native frame rate (rounded). Playwright's recordVideo emits ~25fps, NOT 30 — and
// resampling 25→30 in the build duplicates 1 frame in 5, which JUDDERS (a regular hitch on cursor/scroll
// motion, the "stuttering" that's hard to spot in a still). So the whole build must run at the SOURCE fps:
// detect it once from a segment and thread it through imageClip / trimDeadAir / concat so nothing resamples.
export function probeFps(file, fallback = 25) {
  try {
    const r = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of default=nw=1:nk=1 "${file}"`, { encoding: 'utf8' }).trim();
    const [n, d] = r.split('/').map(Number);
    const fps = Math.round(n / (d || 1));
    return fps > 0 && Number.isFinite(fps) ? fps : fallback;
  } catch { return fallback; }
}

export function imageClip(png, dur, out, fps = 25) {
  sh(`ffmpeg -y -loop 1 -t ${dur} -i "${png}" -vf "scale=1920:1080,fps=${fps},format=yuv420p" ${VENC} "${out}"`);
}

// Normalise a recording to mp4; optionally speed up the [from,to] second span by `factor`.
// CAUTION: webm duration from Playwright is unreliable — do NOT calibrate from/to off ffprobe's
// reported length. Prefer playing real-time (omit `speed`) and keeping in-script waits short, or
// re-measure the span against the actual recording before trusting it.
export function videoClip(webm, out, speed, fps = 25) {
  if (speed) {
    const { from, to, factor } = speed;
    sh(`ffmpeg -y -i "${webm}" -filter_complex "[0:v]trim=0:${from},setpts=PTS-STARTPTS,fps=${fps}[a];[0:v]trim=${from}:${to},setpts=(PTS-STARTPTS)/${factor},fps=${fps}[b];[0:v]trim=${to},setpts=PTS-STARTPTS,fps=${fps}[c];[a][b][c]concat=n=3:v=1,format=yuv420p[v]" -map "[v]" ${VENC} "${out}"`);
  } else {
    sh(`ffmpeg -y -i "${webm}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=${fps},format=yuv420p" ${VENC} "${out}"`);
  }
}

// Per-frame MD5 hashes (one per frame at the given fps), in order. Two consecutive equal hashes mean
// the rendered frames are PIXEL-FOR-PIXEL identical — the only thing that counts as "dead air". Because
// the branded cursor and any page change alter pixels, a cursor glide or a loading/transitioning page
// produces all-different hashes and is never seen as static. This is far more reliable than freezedetect's
// MSE, which can't see a small moving cursor against an otherwise-static page (the over-trim that hard-cut
// real browsing). Returns the array of hashes; frame i is at t = i/fps.
function frameHashes(webm, fps = 30) {
  let out = '';
  try {
    out = execSync(`ffmpeg -hide_banner -loglevel error -i "${webm}" -vf fps=${fps} -an -f framemd5 -`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { return []; }
  const hashes = [];
  for (const line of out.split('\n')) {
    if (!line || line[0] === '#') continue;
    const c = line.lastIndexOf(',');
    if (c > 0) hashes.push(line.slice(c + 1).trim());
  }
  return hashes;
}

// Auto-trim dead air to User's spec: dead air is a run of PIXEL-FOR-PIXEL identical frames with no
// annotation on screen. A page-load/transition (pixels changing) and a cursor glide (cursor pixels moving)
// are never identical, so they are never cut — the video plays as continuous browsing. Only a genuinely
// static run longer than `holdSec` gets clamped down to a `holdSec` head; a run overlapping an annotation
// hold (`annot` = [[start,end],…] seconds, from the recorder's `<webm>.annot.json` sidecar — see studio's
// shot()/finish()) is kept in full (intentional read pacing). `minRunSec`/`holdSec` = User's 0.5s threshold.
// Returns the list of removed [start,end] intervals (original-time seconds). With `noBlankDrop:true` the
// near-white blank-frame drop is skipped — needed on a white-background recording, where that filter would
// otherwise treat real content frames as page-load blanks and delete them (see `assembly.md`). White
// load-blank runs are pixel-identical anyway, so they're still clamped as static runs; only sub-threshold
// single white flashes survive, which are imperceptible.
export function trimDeadAir(webm, out, { minRunSec = 0.5, holdSec = 0.5, fps = 25, annot = [], annotPad = 0.6, blankYavg = 227, noBlankDrop = false } = {}) {
  // norm normally also drops near-pure-white load-blank frames (a goto/reload paints white before render).
  const blank = noBlankDrop ? '' : `signalstats,metadata=mode=select:key=lavfi.signalstats.YAVG:value=${blankYavg}:function=less,`;
  const norm = `${blank}setpts=N/${fps}/TB,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=${fps},format=yuv420p`;
  const hashes = frameHashes(webm, fps);
  const N = hashes.length;
  if (!N) { sh(`ffmpeg -y -i "${webm}" -vf "${norm}" ${VENC} "${out}"`); return []; }
  const dur = N / fps;
  const minRun = Math.max(2, Math.round(minRunSec * fps));
  const cuts = []; // [start,end] seconds to remove (the excess of each over-long static run)
  let i = 0, runs = 0;
  while (i < N) {
    let j = i;
    while (j + 1 < N && hashes[j + 1] === hashes[i]) j++;
    if (j - i + 1 >= minRun) {
      const ts = i / fps, te = (j + 1) / fps;
      runs++;
      // Keep a run that overlaps a declared annotation hold (padded for the small recorder↔webm offset).
      const annotated = annot.some(([s, e]) => ts < e + annotPad && te > s - annotPad);
      if (!annotated) { const headEnd = ts + holdSec; if (te > headEnd + 0.02) cuts.push([headEnd, te]); }
    }
    i = j + 1;
  }
  if (!cuts.length) { sh(`ffmpeg -y -i "${webm}" -vf "${norm}" ${VENC} "${out}"`); return []; }
  // Invert the cut intervals into the keep intervals.
  const keep = [];
  let prev = 0;
  for (const [cs, ce] of cuts) { if (cs > prev) keep.push([prev, cs]); prev = ce; }
  if (prev < dur) keep.push([prev, dur]);
  const valid = keep.filter(([a, b]) => b - a > 0.04);
  const parts = valid.map(([a, b], k) => `[0:v]trim=${a.toFixed(3)}:${b.toFixed(3)},setpts=PTS-STARTPTS[t${k}]`).join(';');
  const chain = valid.map((_, k) => `[t${k}]`).join('') + `concat=n=${valid.length}:v=1[c];[c]${norm}[v]`;
  const trimmed = (dur - valid.reduce((s, [a, b]) => s + (b - a), 0)).toFixed(1);
  console.log(`trimDeadAir ${webm}: ${runs} static run(s), clamped ~${trimmed}s of dead air`);
  sh(`ffmpeg -y -i "${webm}" -filter_complex "${parts};${chain}" -map "[v]" ${VENC} "${out}"`);
  return cuts;
}

export function concat(segs, out) {
  const inputs = segs.map((s) => `-i "${s}"`).join(' ');
  const f = segs.map((_, i) => `[${i}:v]`).join('') + `concat=n=${segs.length}:v=1,setsar=1[v]`;
  sh(`ffmpeg -y ${inputs} -filter_complex "${f}" -map "[v]" -aspect 16:9 ${FENC} "${out}"`);
}

export function probeDuration(file) {
  try { return parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${file}"`, { encoding: 'utf8' }).trim()); } catch { return 0; }
}
