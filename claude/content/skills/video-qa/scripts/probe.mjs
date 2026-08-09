#!/usr/bin/env node
// video-qa deterministic probe layer.
//
// Runs ffprobe/ffmpeg detectors over a demo MP4 and emits a single structured
// JSON report on stdout. No model reasoning happens here — this layer only does
// the mechanical, repeatable measurement so the analysis subagent reasons over a
// compact report + a bounded set of frames instead of the whole video. See
// references/methodology.md for why the split exists.
//
// Usage:
//   node probe.mjs --video <path> [--out <report.json>] [--frames-dir <dir>]
//                  [--card-rgb 57,64,245] [--card-tol 45]
//                  [--demo-freeze 0.5] [--annot-freeze 1.5]
//                  [--cards-file <cards.json>] [--card-min-read 2.5]
//                  [--annotate-rgb 204,65,65] [--annotate-tol 40]
//
// --annotate-rgb: when given, a held "look here" annotation ring in this colour
//   marks a dead-air region as intentional (annotated) and excludes it from the
//   headline dead-air count. Absent ⇒ unchanged behaviour. See references/detectors.md.
//
// Exit codes: 0 ok, 2 bad args / missing input, 3 ffmpeg/ffprobe failure.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

function parseArgs(argv) {
  const a = { cardRgb: [57, 64, 245], cardTol: 45, demoFreeze: 0.5, annotFreeze: 1.5, cardMinRead: 2.5, annotateTol: 40 };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--video': a.video = v; i++; break;
      case '--out': a.out = v; i++; break;
      case '--frames-dir': a.framesDir = v; i++; break;
      case '--card-rgb': a.cardRgb = v.split(',').map(Number); i++; break;
      case '--card-tol': a.cardTol = Number(v); i++; break;
      case '--demo-freeze': a.demoFreeze = Number(v); i++; break;
      case '--annot-freeze': a.annotFreeze = Number(v); i++; break;
      case '--cards-file': a.cardsFile = v; i++; break;
      case '--card-min-read': a.cardMinRead = Number(v); i++; break;
      case '--annotate-rgb': a.annotateRgb = v.split(',').map(Number); i++; break;
      case '--annotate-tol': a.annotateTol = Number(v); i++; break;
      default: break;
    }
  }
  return a;
}

function die(code, msg) {
  process.stderr.write(`probe: ${msg}\n`);
  process.exit(code);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
  if (r.error) die(3, `${cmd} failed to launch: ${r.error.message}`);
  return r;
}

function round(n, d = 2) { return Math.round(n * 10 ** d) / 10 ** d; }

function ffprobeJson(video) {
  const r = run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,sample_aspect_ratio,display_aspect_ratio,r_frame_rate,avg_frame_rate,nb_frames,pix_fmt',
    '-of', 'json', video,
  ]);
  if (r.status !== 0) die(3, `ffprobe metadata failed: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

// freezedetect emits start/duration/end triples on stderr.
function freezeSpans(video, noiseDb, minDur) {
  const r = run('ffmpeg', [
    '-hide_banner', '-i', video,
    '-vf', `freezedetect=n=${noiseDb}dB:d=${minDur}`,
    '-map', '0:v', '-f', 'null', '-',
  ]);
  const text = r.stderr || '';
  const spans = [];
  let cur = null;
  for (const line of text.split('\n')) {
    let m;
    if ((m = line.match(/freeze_start:\s*([0-9.]+)/))) cur = { start: +m[1] };
    else if ((m = line.match(/freeze_duration:\s*([0-9.]+)/)) && cur) cur.duration = +m[1];
    else if ((m = line.match(/freeze_end:\s*([0-9.]+)/)) && cur) {
      cur.end = +m[1];
      if (cur.duration > 0) spans.push(cur);
      cur = null;
    }
  }
  return spans;
}

// Timestamps of every frame mpdecimate keeps (i.e. every frame that visibly
// differs from the previous one). One decode pass for the whole video; callers
// bucket these into windows in JS to derive motion density anywhere, instead of
// re-decoding per window. Motion density (unique frames/sec) separates dead air —
// a held still UI frame — from genuine interaction far better than freezedetect,
// which over-fires on the naturally-static stretches between cursor moves. A
// static brand card lands ~0.3/s; sluggish/dead UI ~0.5-2/s; interaction >5/s.
function keptFrameTimestamps(video) {
  const r = run('ffmpeg', [
    '-hide_banner', '-i', video, '-vf', 'mpdecimate,showinfo', '-an', '-f', 'null', '-',
  ]);
  const out = [];
  const re = /pts_time:([0-9.]+)/g;
  let m;
  while ((m = re.exec(r.stderr || '')) !== null) out.push(+m[1]);
  return out;
}

// unique frames per second within [start, start+dur) from a sorted PTS list.
function densityFrom(pts, start, dur) {
  if (dur <= 0) return 0;
  const end = start + dur;
  let n = 0;
  for (const t of pts) { if (t >= start && t < end) n++; else if (t >= end) break; }
  return round(n / dur, 2);
}

// scdet emits a scene-change score+time per detected cut.
function sceneCuts(video, threshold) {
  const r = run('ffmpeg', [
    '-hide_banner', '-i', video,
    '-vf', `scdet=threshold=${threshold}`,
    '-map', '0:v', '-f', 'null', '-',
  ]);
  const cuts = [];
  const re = /lavfi\.scd\.score:\s*([0-9.]+)[\s\S]*?lavfi\.scd\.time:\s*([0-9.]+)/g;
  // scores and times arrive on adjacent lines; pair them by scanning lines.
  const lines = (r.stderr || '').split('\n');
  let score = null;
  for (const line of lines) {
    let m;
    if ((m = line.match(/lavfi\.scd\.score:\s*([0-9.]+)/))) score = +m[1];
    if ((m = line.match(/lavfi\.scd\.time:\s*([0-9.]+)/))) {
      cuts.push({ time: +m[1], score: score ?? null });
      score = null;
    }
  }
  void re;
  return cuts;
}

// Average colour of a single frame, sampled by downscaling to 1x1.
// Cheap and robust for "is this a solid-colour brand card?".
function avgColorAt(video, t) {
  const r = run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-ss', String(t), '-i', video, '-frames:v', '1',
    '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
  ], { encoding: 'buffer' });
  const b = r.stdout;
  if (!b || b.length < 3) return null;
  return [b[0], b[1], b[2]];
}

// Detect a held "look here" annotation ring at time t. Recorders draw a thin
// rounded-rectangle outline in the annotation colour around a UI element and hold
// it ~1.5-2s on purpose, so a still frame carrying one is intentional pacing, not
// dead air. We sample the full-res frame, count pixels within `tol` of the
// annotation colour, and take the bounding box of those matches. A RING is:
//   - a moderate cluster of matched pixels (>= RING_MIN_PX) — well above the handful
//     the cursor alone contributes, but nowhere near a solid fill;
//   - clustered into ONE compact bounding box, not scattered across the screen.
// The bounding box is the key discriminator from incidental brand-red UI (a red
// status pill, a disabled-action icon, the cursor): those land as a few hundred
// pixels smeared across a very wide/flat box (aspect ratio in the tens), whereas a
// ring around one control is a roughly square-ish box (aspect within ~[0.15, 6.5])
// that covers a meaningful but sub-screen fraction of the frame. Thresholds tuned
// against the reference fixture: a real upload-control ring = ~1550px in a 547x483
// box (aspect 1.13); incidental row red = ~560px in a 1683x36 box (aspect 46).
function annotationRingAt(video, t, target, tol, frameW, frameH) {
  const r = run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-ss', String(t), '-i', video, '-frames:v', '1',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
  ], { encoding: 'buffer' });
  const b = r.stdout;
  if (!b || b.length < frameW * frameH * 3 * 0.5) return { matchPx: 0, ring: false };
  const [tr, tg, tb] = target;
  let n = 0, minx = frameW, miny = frameH, maxx = 0, maxy = 0;
  for (let p = 0; p * 3 + 2 < b.length; p++) {
    const i = p * 3;
    if (Math.abs(b[i] - tr) <= tol && Math.abs(b[i + 1] - tg) <= tol && Math.abs(b[i + 2] - tb) <= tol) {
      n++;
      const x = p % frameW, y = (p / frameW) | 0;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
  }
  const RING_MIN_PX = 500;          // above cursor-only noise, below any fill
  const ASPECT_LO = 0.15, ASPECT_HI = 6.5; // a ring's box is roughly square-ish
  const MAX_BOX_FRAC = 0.85;        // a real fill would span almost the whole frame
  let ring = false, bbox = null, aspect = null;
  if (n >= RING_MIN_PX) {
    const bw = maxx - minx + 1, bh = maxy - miny + 1;
    aspect = bw / bh;
    const boxFrac = (bw * bh) / (frameW * frameH);
    const fill = n / (bw * bh); // ring outlines its box thinly; a solid blob fills it
    ring = aspect >= ASPECT_LO && aspect <= ASPECT_HI && boxFrac <= MAX_BOX_FRAC && fill < 0.5;
    bbox = { w: bw, h: bh };
  }
  return { matchPx: n, ring, bbox, aspect: aspect != null ? round(aspect, 2) : null };
}

// Mean + spread of luma over a frame, plus a coarse 3x3 luma grid, so the
// analysis layer can spot low-contrast / inherited-colour traps without a frame.
function lumaStatsAt(video, t) {
  const r = run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-ss', String(t), '-i', video, '-frames:v', '1',
    '-vf', 'scale=3:3,format=gray', '-f', 'rawvideo', '-pix_fmt', 'gray', '-',
  ], { encoding: 'buffer' });
  const b = r.stdout;
  if (!b || b.length < 9) return null;
  const g = Array.from(b.slice(0, 9));
  const mean = g.reduce((s, x) => s + x, 0) / 9;
  const min = Math.min(...g);
  const max = Math.max(...g);
  return { mean: Math.round(mean), min, max, spread: max - min, grid: g };
}

function inCardSpan(spans, t) {
  return spans.some((s) => s.kind === 'card' && t >= s.start - 0.3 && t <= s.end + 0.3);
}

// 8x8 grayscale signature of a frame — fine enough to distinguish two cards that
// share a background colour by their text layout, coarse enough to ignore
// compression noise. Used to split a colour block that contains more than one
// authored card (e.g. cover -> agenda on the same brand background, with no scene
// cut between them).
function lumaSignatureAt(video, t) {
  const r = run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-ss', String(t), '-i', video, '-frames:v', '1',
    '-vf', 'scale=8:8,format=gray', '-f', 'rawvideo', '-pix_fmt', 'gray', '-',
  ], { encoding: 'buffer' });
  const b = r.stdout;
  if (!b || b.length < 64) return null;
  return Array.from(b.slice(0, 64));
}

// mean absolute per-cell difference between two 8x8 signatures (0-255).
function signatureDelta(a, b) {
  if (!a || !b) return 0;
  let s = 0;
  for (let i = 0; i < 64; i++) s += Math.abs(a[i] - b[i]);
  return s / 64;
}

// Within a single card colour block, find sub-card boundaries by walking the luma
// signature in ~1s steps: where it shifts by more than DELTA, the on-screen text
// changed -> a new authored card on the same background. Returns the block split
// into one or more [start,end) sub-cards.
function splitCardBlock(video, start, end, stepSec = 1.0, delta = 6) {
  const subs = [];
  let segStart = start;
  let prevSig = lumaSignatureAt(video, start + 0.2);
  for (let t = start + stepSec; t < end - 0.15; t += stepSec) {
    const sig = lumaSignatureAt(video, t);
    if (signatureDelta(prevSig, sig) > delta) {
      // boundary between t-step and t; place it at the midpoint
      const bound = round(t - stepSec / 2, 2);
      if (bound - segStart > 0.4) { subs.push({ start: round(segStart, 2), end: bound }); segStart = bound; }
    }
    prevSig = sig;
  }
  subs.push({ start: round(segStart, 2), end: round(end, 2) });
  return subs;
}

function isCardColor(rgb, target, tol) {
  if (!rgb) return false;
  return Math.abs(rgb[0] - target[0]) <= tol
    && Math.abs(rgb[1] - target[1]) <= tol
    && Math.abs(rgb[2] - target[2]) <= tol;
}

function extractFrame(video, t, outPath, width = 1280) {
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-ss', String(t), '-i', video, '-frames:v', '1',
    '-vf', `scale=${width}:-1`, '-y', outPath,
  ]);
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.video || !existsSync(args.video)) die(2, `--video missing or not found: ${args.video}`);

  const framesDir = args.framesDir || join(process.cwd(), 'video-qa-frames');
  mkdirSync(framesDir, { recursive: true });

  const meta = ffprobeJson(args.video);
  const vstream = (meta.streams || []).find((s) => s.codec_type === 'video') || {};
  const duration = Number(meta.format?.duration || 0);
  if (!duration) die(3, 'could not read duration');

  // Detector params. Freeze noise floor at -55dB keeps near-static UI from being
  // missed while ignoring true codec noise. The freeze floor is the demo-segment
  // bar (--demo-freeze): stillness shorter than this is acceptable demo pacing and
  // not reported at all, so the freeze list only carries holds worth a reviewer's
  // attention. The warn/error split then uses --annot-freeze (see classification).
  const FREEZE_NOISE = -55;
  const FREEZE_MIN = args.demoFreeze;
  const SCENE_THRESHOLD = 6;

  const freezes = freezeSpans(args.video, FREEZE_NOISE, FREEZE_MIN);
  const cuts = sceneCuts(args.video, SCENE_THRESHOLD);

  // --- Card / segment map -------------------------------------------------
  // A "card" is a stretch whose representative frame is the brand solid colour.
  // We classify each scene-bounded span by sampling its midpoint colour.
  // A window whose motion density is below this (unique frames/sec) is holding a
  // near-still frame — dead air for a live-product walkthrough. Tuned against the
  // fixture: static cards ~0.3/s, dead UI ~0.5-2/s, healthy interaction >5/s.
  const DEADAIR_PERSEC = 2.0;
  const boundaries = [0, ...cuts.map((c) => c.time), duration].sort((a, b) => a - b);
  const spans = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (end - start < 0.20) continue; // collapse sub-frame slivers (glitch clusters)
    const dur = end - start;
    const mid = start + dur / 2;
    const rgb = avgColorAt(args.video, mid);
    const luma = lumaStatsAt(args.video, mid);
    const kind = isCardColor(rgb, args.cardRgb, args.cardTol) ? 'card' : 'ui';
    spans.push({
      start: round(start), end: round(end), duration: round(dur),
      midColorRgb: rgb, kind, luma,
    });
  }

  // --- Card blocks + storyboard cross-check ------------------------------
  // A single authored card can straddle two scene cuts (its cross-dissolve in/out
  // each register as a cut), so merge contiguous 'card' spans into one block with
  // the card's true on-screen duration. Then, if the caller passed the expected
  // storyboard cards (--cards-file: a JSON array of {label, minRead?}), pair the
  // detected blocks to the expected cards IN ORDER and report present / too-brief /
  // missing per card. The probe owns count, duration and ordering — the legibility,
  // wording and "undercut by neighbours" judgments are the analysis subagent's job
  // over the card frames (it can read text; the probe can't). Scripted cards are
  // deliberately authored narration, so this cross-check is a first-class output.
  const mergedBlocks = [];
  for (const s of spans) {
    if (s.kind !== 'card') continue;
    const last = mergedBlocks[mergedBlocks.length - 1];
    if (last && s.start - last.end <= 0.5) {
      last.end = s.end; last.duration = round(last.end - last.start); last.spanCount++;
    } else {
      mergedBlocks.push({ start: s.start, end: s.end, duration: s.duration, spanCount: 1 });
    }
  }
  // Two authored cards on the same brand background (e.g. cover -> agenda) produce
  // no scene cut, so they land in one merged block. Split each block by its on-screen
  // text signature so one authored card == one detected block; the cross-check below
  // then pairs cleanly against the storyboard.
  const cardBlocks = [];
  for (const b of mergedBlocks) {
    for (const sub of splitCardBlock(args.video, b.start, b.end)) {
      cardBlocks.push({ start: sub.start, end: sub.end, duration: round(sub.end - sub.start), spanCount: 1 });
    }
  }

  // Expected cards: optional. Each entry {label, minRead?}; minRead falls back to
  // the global --card-min-read (default 2.5s — a text-heavy card needs ~2.5s to read).
  let expectedCards = null;
  if (args.cardsFile) {
    if (!existsSync(args.cardsFile)) die(2, `--cards-file not found: ${args.cardsFile}`);
    try {
      const parsed = JSON.parse(readFileSync(args.cardsFile, 'utf8'));
      expectedCards = Array.isArray(parsed) ? parsed : parsed.cards;
      if (!Array.isArray(expectedCards)) throw new Error('expected a JSON array of cards');
    } catch (e) { die(2, `could not parse --cards-file: ${e.message}`); }
  }

  let cardCheck = null;
  if (expectedCards) {
    // Pair expected[i] -> cardBlocks[i] positionally. This assumes the cards appear
    // in storyboard order (they are authored narration, so they do). A mismatch in
    // count is itself a finding the caller surfaces.
    const results = expectedCards.map((c, i) => {
      const label = typeof c === 'string' ? c : c.label;
      const minRead = (typeof c === 'object' && c.minRead != null) ? c.minRead : args.cardMinRead;
      const block = cardBlocks[i] || null;
      let status;
      if (!block) status = 'missing';
      else if (block.duration < minRead) status = 'too-brief';
      else status = 'present';
      return {
        index: i, label, minRead, status,
        block: block ? { start: block.start, end: block.end, duration: block.duration } : null,
      };
    });
    cardCheck = {
      expectedCount: expectedCards.length,
      detectedBlockCount: cardBlocks.length,
      countMatches: expectedCards.length === cardBlocks.length,
      // extra detected blocks beyond the expected list (e.g. an unscripted card)
      extraBlocks: cardBlocks.slice(expectedCards.length).map((b) => ({ start: b.start, end: b.end, duration: b.duration })),
      results,
    };
  } else {
    // No storyboard cards supplied — still surface the detected blocks so the
    // subagent (and caller) can reason about them.
    cardCheck = { expectedCount: null, detectedBlockCount: cardBlocks.length, results: null,
      detectedBlocks: cardBlocks.map((b) => ({ start: b.start, end: b.end, duration: b.duration })) };
  }

  // --- Windowed dead-air scan --------------------------------------------
  // Scene cuts are sparse inside long single-screen UI regions (e.g. a 78s stretch
  // on one dashboard), so a per-span motion average smears genuine dead air across
  // active moments. We instead sample motion density in fixed WINDOW-second steps
  // across the whole timeline, mark windows that overlap a 'card' region as
  // expected-static, and merge contiguous low-motion ui windows into dead-air
  // regions. This is what localises the 64s frozen-dashboard hold in the fixture.
  const pts = keptFrameTimestamps(args.video);
  const WINDOW = 6;
  const windows = [];
  for (let t = 0; t < duration - 0.5; t += WINDOW) {
    const w = Math.min(WINDOW, duration - t);
    if (w < 1.5) break;
    const mid = t + w / 2;
    const onCard = inCardSpan(spans, mid);
    windows.push({ start: round(t), end: round(t + w), perSec: densityFrom(pts, t, w), region: onCard ? 'card' : 'ui' });
  }
  // merge contiguous low-motion ui windows
  const deadAirRegions = [];
  let cur = null;
  for (const w of windows) {
    const low = w.region === 'ui' && w.perSec < DEADAIR_PERSEC;
    if (low) {
      if (cur) { cur.end = w.end; cur.windows.push(w.perSec); }
      else cur = { start: w.start, end: w.end, windows: [w.perSec] };
    } else if (cur) { deadAirRegions.push(cur); cur = null; }
  }
  if (cur) deadAirRegions.push(cur);
  const deadAir = deadAirRegions
    .map((d) => ({
      start: round(d.start), end: round(d.end), duration: round(d.end - d.start),
      avgMotionPerSec: round(d.windows.reduce((s, x) => s + x, 0) / d.windows.length),
    }))
    // a single ~6s low window is borderline; surface holds ≥4s of sustained low motion
    .filter((d) => d.duration >= 4);

  // --- Annotation-aware dead-air (optional, --annotate-rgb) ---------------
  // A held still frame that carries a "look here" annotation ring is intentional
  // pacing, not dead air. When the annotation colour is supplied, sample each
  // dead-air region's midpoint for a ring; flag those regions `annotated` and keep
  // them out of the headline dead-air defect count (they stay in the report so the
  // analysis subagent can still sanity-check that the ring points at the right
  // thing). Without --annotate-rgb every region is treated as before (annotated:
  // false), so behaviour is unchanged.
  if (args.annotateRgb && args.annotateRgb.length === 3) {
    for (const d of deadAir) {
      const mid = round((d.start + d.end) / 2);
      const res = annotationRingAt(args.video, mid, args.annotateRgb, args.annotateTol, vstream.width, vstream.height);
      d.annotated = res.ring;
      d.annotateMatchPx = res.matchPx;
      if (res.bbox) d.annotateBox = res.bbox;
      if (res.aspect != null) d.annotateAspect = res.aspect;
    }
  } else {
    for (const d of deadAir) d.annotated = false;
  }

  // --- Glitch heuristic ---------------------------------------------------
  // A cluster of ≥3 scene cuts inside a 1.2s window that is NOT a card↔ui
  // transition reads as a stray refresh / page-hop flicker rather than an
  // intended cut. Card transitions naturally produce 2-4 cuts (cross-dissolve),
  // so we only flag clusters that sit wholly inside a single 'ui' region.
  const glitchWindows = [];
  const CLUSTER_WIN = 1.2;
  const CLUSTER_MIN = 3;
  for (let i = 0; i < cuts.length; i++) {
    const group = [cuts[i]];
    let j = i + 1;
    while (j < cuts.length && cuts[j].time - cuts[i].time <= CLUSTER_WIN) {
      group.push(cuts[j]); j++;
    }
    if (group.length >= CLUSTER_MIN) {
      const t0 = group[0].time;
      const t1 = group[group.length - 1].time;
      const mid = (t0 + t1) / 2;
      // is this cluster inside a ui region (not bracketing a card)?
      const before = avgColorAt(args.video, Math.max(0, t0 - 0.4));
      const after = avgColorAt(args.video, Math.min(duration - 0.05, t1 + 0.4));
      const touchesCard = isCardColor(before, args.cardRgb, args.cardTol)
        || isCardColor(after, args.cardRgb, args.cardTol);
      if (!touchesCard) {
        glitchWindows.push({ start: round(t0), end: round(t1), cuts: group.length, mid: round(mid) });
      }
      i = j - 1;
    }
  }

  // --- Freeze classification ---------------------------------------------
  // Map each freeze onto the span(s) it overlaps. Freezes inside 'card' spans
  // are expected (cards are static). Freezes inside 'ui' spans are the demo
  // problem: a live product walkthrough should not hold a still UI frame.
  const cardRanges = spans.filter((s) => s.kind === 'card');
  function inCard(t) {
    return cardRanges.some((s) => t >= s.start - 0.3 && t <= s.end + 0.3);
  }
  const classifiedFreezes = freezes.map((f) => {
    const onCard = inCard(f.start) || inCard(f.end) || inCard((f.start + f.end) / 2);
    let severity = 'ok';
    if (!onCard) {
      // Tight gates so the freeze list pinpoints genuine holds, not the routine
      // sub-second stillness between cursor moves. The windowed motion-density scan
      // is the primary dead-air signal; this just locates the exact frozen frame.
      // error gate = a held annotation's tolerance doubled (a clearly-too-long hold).
      if (f.duration > args.annotFreeze * 2) severity = 'error';
      else if (f.duration > args.annotFreeze) severity = 'warn';
    }
    return {
      start: round(f.start), end: round(f.end), duration: round(f.duration),
      region: onCard ? 'card' : 'ui', severity,
    };
  });

  // --- Bounded frame extraction ------------------------------------------
  // The analysis subagent never sees the whole video. We hand it: one frame at
  // the middle of every span (scene representative), one at each glitch window,
  // and one at the start of every ui freeze flagged warn/error. This is the
  // bounded, well-chosen frame set called out in the methodology.
  const frameJobs = [];
  spans.forEach((s, idx) => {
    const t = round(s.start + s.duration / 2);
    frameJobs.push({ t, name: `span-${String(idx).padStart(3, '0')}-${s.kind}-${Math.round(t)}s.png`, reason: `${s.kind} span ${s.start}-${s.end}` });
  });

  // Guarantee: every detected card (a cardBlock — the finest card unit, after the
  // signature split that separates two cards sharing one brand background, e.g.
  // cover -> agenda) contributes at least one frame the analysis layer can point
  // at, sampled at the block midpoint clamped strictly inside the block. Without
  // this, a short card (e.g. a ~3.6s opening COVER) could fall between the span
  // representatives — the merged colour span's midpoint lands on the *next* card
  // on the same background (the agenda), so the analysis would see no cover frame
  // and wrongly conclude the cover is absent. The card-N-text frames below sample
  // the same blocks, but cardSpansReport makes the card->frame map explicit so the
  // absence judgement is read from the report, not inferred from which frames exist.
  const cardSpanFrames = cardBlocks.map((b, idx) => {
    // clamp the sample point inside the block so the in/out cross-dissolve frames
    // (which average toward the neighbouring ui screen) are never picked.
    const inset = Math.min(0.3, b.duration / 4);
    const mid = round(Math.min(b.end - inset, Math.max(b.start + inset, b.start + b.duration / 2)));
    const name = `cardspan-${idx}-mid-${Math.round(mid)}s.png`;
    frameJobs.push({ t: mid, name, reason: `card block ${b.start}-${b.end} (${b.duration}s) — guaranteed representative` });
    return { index: idx, start: b.start, end: b.end, duration: b.duration, midpoint: mid, framePath: join(framesDir, name) };
  });
  // Scripted cards get explicit, well-named frames: the card itself (mid-block, to
  // read its text and check legibility/branding) and the frame ~0.6s AFTER the block
  // ends (the first thing the viewer sees next, to check the card isn't undercut by
  // an empty/contradicting screen). Cards are authored narration, so they are a
  // first-class check — naming the frames per card makes the cross-check legible.
  cardBlocks.forEach((b, idx) => {
    const mid = round(b.start + b.duration / 2);
    frameJobs.push({ t: mid, name: `card-${idx}-text-${Math.round(mid)}s.png`, reason: `card block ${b.start}-${b.end} (${b.duration}s) — read text` });
    const after = round(Math.min(duration - 0.05, b.end + 0.6));
    frameJobs.push({ t: after, name: `card-${idx}-after-${Math.round(after)}s.png`, reason: `frame after card block ${idx} — undercut check` });
  });
  // Dead-air regions can be long; sample start, middle and end so the analysis
  // layer can see whether the held screen is plumbing (e.g. an admin/job console)
  // or product.
  deadAir.forEach((d, idx) => {
    [d.start + 0.5, round((d.start + d.end) / 2), d.end - 0.5].forEach((t, k) => {
      frameJobs.push({ t: round(t), name: `deadair-${idx}-${['a', 'b', 'c'][k]}-${Math.round(t)}s.png`, reason: `dead air ${d.start}-${d.end} (${d.duration}s, ${d.avgMotionPerSec}/s)` });
    });
  });
  glitchWindows.forEach((g, idx) => {
    // a frame just before and just after the cluster lets the analysis layer see
    // whether the screen content actually changed (real refresh) or only flickered.
    frameJobs.push({ t: round(Math.max(0, g.start - 0.5)), name: `glitch-${idx}-pre-${Math.round(g.start)}s.png`, reason: `glitch cluster ${g.cuts} cuts (before)` });
    frameJobs.push({ t: round(Math.min(duration - 0.05, g.end + 0.5)), name: `glitch-${idx}-post-${Math.round(g.end)}s.png`, reason: `glitch cluster ${g.cuts} cuts (after)` });
  });
  // Deliberately NOT extracting a frame per freezedetect hit. On a screen recording
  // freezedetect fires on every static stretch between cursor moves; the windowed
  // dead-air scan above is the authoritative still-frame signal and already samples
  // those regions. Freezes stay in the JSON as supporting timing data only, so the
  // frame set the analysis subagent receives stays bounded and well-chosen.

  const frames = [];
  for (const job of frameJobs) {
    const outPath = join(framesDir, job.name);
    extractFrame(args.video, job.t, outPath);
    frames.push({ t: job.t, path: outPath, reason: job.reason });
  }

  const fps = (() => {
    const [n, d] = String(vstream.avg_frame_rate || '0/1').split('/').map(Number);
    return d ? round(n / d, 3) : null;
  })();

  const report = {
    schemaVersion: 1,
    video: { path: args.video, name: basename(args.video) },
    metadata: {
      durationSec: round(duration), width: vstream.width, height: vstream.height,
      fps, sar: vstream.sample_aspect_ratio, dar: vstream.display_aspect_ratio,
      pixFmt: vstream.pix_fmt, codec: vstream.codec_name,
      sizeBytes: Number(meta.format?.size || 0), bitRate: Number(meta.format?.bit_rate || 0),
    },
    detectorParams: {
      freezeNoiseDb: FREEZE_NOISE, freezeMinSec: FREEZE_MIN, sceneThreshold: SCENE_THRESHOLD,
      cardRgb: args.cardRgb, cardTol: args.cardTol,
      demoFreezeSec: args.demoFreeze, annotFreezeSec: args.annotFreeze,
      cardMinReadSec: args.cardMinRead,
      annotateRgb: args.annotateRgb || null, annotateTol: args.annotateRgb ? args.annotateTol : null,
      glitchWindowSec: CLUSTER_WIN, glitchMinCuts: CLUSTER_MIN,
    },
    structure: {
      spanCount: spans.length,
      cardSpans: spans.filter((s) => s.kind === 'card').length,
      uiSpans: spans.filter((s) => s.kind === 'ui').length,
      spans,
    },
    // Every detected brand-card span with its timing and the guaranteed frame the
    // analysis layer should look at before judging a scripted card present/absent.
    // This is the machine-readable card->frame map; never conclude a card is
    // absent without inspecting the frame named here for the matching span.
    cardSpans: cardSpanFrames,
    cardCheck,
    deadAir: {
      // Headline figures count only un-annotated stillness — a held annotation ring
      // is intentional pacing, not a defect. Annotated regions stay in `regions`
      // (flagged annotated:true) and are also listed separately so the analysis can
      // sanity-check them without inflating the defect count.
      regionCount: deadAir.filter((d) => !d.annotated).length,
      totalSec: round(deadAir.filter((d) => !d.annotated).reduce((s, d) => s + d.duration, 0)),
      annotatedRegionCount: deadAir.filter((d) => d.annotated).length,
      annotatedRegions: deadAir.filter((d) => d.annotated),
      regions: deadAir,
    },
    motionWindows: windows,
    sceneCuts: cuts.map((c) => ({ time: round(c.time), score: c.score != null ? round(c.score, 3) : null })),
    freezes: classifiedFreezes,
    freezeSummary: {
      uiWarn: classifiedFreezes.filter((f) => f.severity === 'warn').length,
      uiError: classifiedFreezes.filter((f) => f.severity === 'error').length,
      cardFreezes: classifiedFreezes.filter((f) => f.region === 'card').length,
    },
    glitches: glitchWindows,
    framesDir,
    frames,
  };

  const json = JSON.stringify(report, null, 2);
  if (args.out) { writeFileSync(args.out, json); process.stderr.write(`probe: wrote ${args.out}\n`); }
  else process.stdout.write(json + '\n');
}

main();
