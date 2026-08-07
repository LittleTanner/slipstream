// EXPORT THE SIM'S BEHAVIOUR AS LANGUAGE-NEUTRAL DATA, so a Swift port can prove it matches
// this one instead of hoping. Writes `port/` and nothing else; run it after any sim change:
//
//   node tools/extract.js && node tools/port-export.js && node tools/port-verify.js
//
// WHY THIS EXISTS AND WHY THE GOLDEN IS NOT ENOUGH. `tools/golden.json` is a 1590-check
// specification of what a race RESULTS IN: finishing order, times, points, money, the course a
// seed draws. That is exactly the right contract for "did I break the game", and it is the
// wrong tool for "my Swift sim is 0.3s off at Division 4 and I have no idea where". A result is
// the sum of 30,000 frames; when it differs, every one of those frames is a suspect.
//
// So this emits three things:
//
//   constants.json  every CFG value, as data. The port reads ONE source of truth instead of
//                   copying 200 numbers by hand. Drift here is silent and fatal.
//   trace.json      per-rider dist / speed / energy sampled through whole races. A Swift port
//                   that diverges can binary-search to the exact second, then the exact frame,
//                   then the exact term. This turns a week of bisecting into an afternoon.
//   protocol.json   the harness contract: fixed timestep, the input policy, the sample cadence,
//                   the tolerances. A fixture nobody can replay is a fixture nobody trusts.
//
// ★ THE TRACE IS THE PART THAT PAYS. Everything else is convenience; this is the thing that
// makes a port SAFE, because it converts "the answer is wrong" into "frame 14,220 is wrong".
const fs = require('fs');
const path = require('path');
const S = require('./sim.js');
const { CFG } = S;

const OUT = path.join(__dirname, '..', 'port');
fs.mkdirSync(OUT, { recursive: true });

// Sampled every SAMPLE frames rather than every frame: at 120 Hz a full trace would be tens of
// megabytes and no more useful, because a port that is correct at 1 s intervals for a whole race
// is not silently wrong in between — any real divergence compounds and shows at the next sample.
const SAMPLE = 120;                       // one sample a second
const ROUND = 6;                          // decimals kept; see protocol.tolerances

// Deliberately spread across the shapes that stress different code paths.
const CASES = [
  { seed: 11, stageIndex: 0, playerType: 'rouleur', div: 8, why: 'flat, the plain case' },
  { seed: 23, stageIndex: 2, playerType: 'climber', div: 4, why: 'mountains: climbs, descents, switchbacks' },
  { seed: 37, stageIndex: 5, playerType: 'rouleur', div: 1, why: 'time trial: intervals, cadence, GEARING' },
];

// THE SAME POLICY THE GOLDEN USES. Copied deliberately rather than imported: this file is a
// specification for another language, so the behaviour it describes has to be readable here in
// full, not one `require` away in a file the Swift author will not open.
function policy(race) {
  const togo = race.course.len - race.you.dist;
  return { rate: togo < 200 ? 4.0 : 0, ease: false, launch: false, stumble: false, tx: race.you.x };
}

const r = v => (typeof v === 'number' && isFinite(v) ? +v.toFixed(ROUND) : v);

function traceCase(c) {
  const gc = {};
  for (const n of ['YOU', ...S.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = S.createRace({ seed: c.seed, stageIndex: c.stageIndex, playerType: c.playerType,
    gc, leaders: {}, div: c.div });
  const names = race.riders.map(x => x.name);
  const samples = [];
  let g = 0;
  while (!race.you.finished && g++ < 120 * 900) {
    S.step(race, CFG.fixedDt, policy(race));
    if (g % SAMPLE === 0) {
      samples.push({
        f: g,
        // Three numbers a rider is enough to localise any divergence: position says WHERE they
        // are, speed says the physics term that put them there, energy says the economy did the
        // same thing. A port matching all three for a whole race is matching the sim.
        d: race.riders.map(x => r(x.dist)),
        v: race.riders.map(x => r(x.speed)),
        e: race.riders.map(x => r(x.energy)),
      });
    }
  }
  const order = S.settle(race);
  return {
    ...c,
    frames: g,
    riders: names,
    gears: !!race.gears,                  // records the TT gearing gate as data, not folklore
    samples,
    result: order.map(x => ({ place: x.place, name: x.name, time: r(x.time),
      sprintPts: x.sprintPts, komPts: x.komPts })),
  };
}

// ---- constants -------------------------------------------------------------
// Every CFG value, flat. Anything non-scalar (the gear ratio array) comes through as-is.
const constants = {};
for (const k of Object.keys(CFG).sort()) constants[k] = CFG[k];

fs.writeFileSync(path.join(OUT, 'constants.json'), JSON.stringify({
  note: 'Every Sim.CFG value from index.html, exported as data. THE PORT MUST READ THESE, not '
      + 'retype them: these numbers were each arrived at by measurement and several are '
      + 'load-bearing in ways their name does not suggest. docs/DECISIONS.md says why for the '
      + 'ones that matter, and index.html carries the reasoning inline beside each.',
  generated: 'node tools/port-export.js',
  count: Object.keys(constants).length,
  constants,
}, null, 2) + '\n');

// ---- protocol --------------------------------------------------------------
fs.writeFileSync(path.join(OUT, 'protocol.json'), JSON.stringify({
  note: 'How to replay trace.json against a port. Follow this exactly; a mismatched harness '
      + 'produces divergence that is not in the sim, which has already cost this project real '
      + 'time three separate times (see docs/DECISIONS.md on harness faults).',
  timestep: { fixedDt: CFG.fixedDt, hz: Math.round(1 / CFG.fixedDt),
    rule: 'ALWAYS step with exactly fixedDt. The sim is deterministic only at a fixed timestep; '
        + 'a variable frame time is a different simulation, not a faster one.' },
  rng: { kind: 'mulberry32', seededPer: 'race',
    rule: 'Course generation consumes the PRNG in a fixed order. Adding, removing or REORDERING '
        + 'a single R() call inside course generation changes every course from that point on. '
        + 'Derive values from existing draws instead of taking new ones.' },
  input: { perFrame: { rate: 'number, taps per second', ease: 'bool', launch: 'bool',
      stumble: 'bool', tx: 'number, desired lane', shiftUp: 'bool', shiftDown: 'bool' },
    policyUsedByTheseTraces:
      'rate = (course.len - you.dist) < 200 ? 4.0 : 0; ease/launch/stumble false; tx = you.x; '
      + 'no shifting. NOTE this policy never steers and never brakes, which is fine for a '
      + 'conformance trace and NOT fine for judging difficulty (see docs/DEV-LOOP.md).' },
  sampling: { everyNFrames: SAMPLE, decimals: ROUND,
    fields: { d: 'rider.dist', v: 'rider.speed', e: 'rider.energy' },
    riderOrder: 'the order of race.riders, given per case as `riders`; index into d/v/e with it' },
  tolerances: {
    perSampleAbs: 1e-4,
    rule: 'Compare sample by sample and STOP AT THE FIRST MISMATCH. The first divergent sample '
        + 'is the bug; every later one is its echo. Report the frame, the rider and the field.',
    whyNotExact: 'Different languages order floating point differently in a few places (Math.hypot, '
        + 'exponentiation). 1e-4 over a race is far tighter than any real behavioural difference '
        + 'and far looser than the last-bit noise.' },
}, null, 2) + '\n');

// ---- traces ----------------------------------------------------------------
const traces = CASES.map(traceCase);
fs.writeFileSync(path.join(OUT, 'trace.json'), JSON.stringify({
  note: 'Frame-sampled conformance traces. See protocol.json. Regenerate with '
      + '`node tools/extract.js && node tools/port-export.js` after ANY sim change, and expect '
      + 'this file to move whenever golden.json moves.',
  sample: SAMPLE, decimals: ROUND,
  cases: traces,
}, null, 2) + '\n');

for (const t of traces) {
  console.log('  ' + ('seed ' + t.seed + '/stage ' + t.stageIndex + '/div ' + t.div).padEnd(30)
    + String(t.samples.length).padStart(4) + ' samples, ' + t.frames + ' frames'
    + (t.gears ? ', gears' : '') + '   (' + t.why + ')');
}
console.log('wrote port/constants.json (' + Object.keys(constants).length + ' values), '
  + 'port/protocol.json, port/trace.json');
