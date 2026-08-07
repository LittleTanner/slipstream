// REPLAY port/trace.json AGAINST THIS SIM. Two jobs, and the second is the important one:
//
//   1. Keeps the fixtures honest. A conformance fixture nobody re-checks rots silently, and a
//      rotten fixture is worse than none: the Swift port would be chasing a divergence from a
//      sim that no longer exists. This fails loudly the moment `port/` is stale.
//   2. IS THE REFERENCE IMPLEMENTATION OF THE COMPARISON. Whoever writes the Swift conformance
//      test should port THIS FILE first, not invent their own comparison. It is fifty lines and
//      it already encodes the decisions that matter: stop at the first mismatch, compare in
//      rider order, use the protocol's tolerance rather than exact equality.
//
//   node tools/extract.js && node tools/port-verify.js
const fs = require('fs');
const path = require('path');
const S = require('./sim.js');
const { CFG } = S;

const dir = path.join(__dirname, '..', 'port');
const load = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
let T, P, K;
try { T = load('trace.json'); P = load('protocol.json'); K = load('constants.json'); }
catch (e) {
  console.error('port/ is missing or unreadable. Run: node tools/port-export.js');
  process.exit(1);
}

const TOL = P.tolerances.perSampleAbs;
let fails = 0, compared = 0;

// The constants file is the port's single source of truth, so a drift between it and the live
// CFG makes every number the port reads a lie. Checked first and cheaply.
for (const k of Object.keys(K.constants)) {
  const a = K.constants[k], b = CFG[k];
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.log('  CONSTANT DRIFT  ' + k + ': port/ has ' + JSON.stringify(a)
      + ', sim has ' + JSON.stringify(b));
    fails++;
  }
}
for (const k of Object.keys(CFG)) if (!(k in K.constants)) {
  console.log('  CONSTANT MISSING from port/: ' + k); fails++;
}

function policy(race) {
  const togo = race.course.len - race.you.dist;
  return { rate: togo < 200 ? 4.0 : 0, ease: false, launch: false, stumble: false, tx: race.you.x };
}

for (const c of T.cases) {
  const gc = {};
  for (const n of ['YOU', ...S.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = S.createRace({ seed: c.seed, stageIndex: c.stageIndex, playerType: c.playerType,
    gc, leaders: {}, div: c.div });
  const tag = 'seed ' + c.seed + '/stage ' + c.stageIndex + '/div ' + c.div;

  if (race.riders.map(x => x.name).join(',') !== c.riders.join(',')) {
    console.log('  ' + tag + ': RIDER ORDER differs, every index below would be meaningless');
    fails++; continue;
  }
  if (!!race.gears !== !!c.gears) {
    console.log('  ' + tag + ': gears ' + !!race.gears + ', fixture says ' + !!c.gears);
    fails++;
  }

  // ★ STOP AT THE FIRST MISMATCH. Every later sample is an echo of the first, and a wall of
  // 400 divergent lines hides the one that matters. This is the single most useful property of
  // the whole kit, and it is the reason to port this comparison rather than write a new one.
  let bad = null, g = 0, si = 0;
  while (!race.you.finished && g++ < 120 * 900) {
    S.step(race, CFG.fixedDt, policy(race));
    if (g % T.sample) continue;
    const s = c.samples[si++];
    if (!s) break;
    for (const [field, get] of [['dist', x => x.dist], ['speed', x => x.speed], ['energy', x => x.energy]]) {
      const exp = s[field[0] === 'd' ? 'd' : field[0] === 's' ? 'v' : 'e'];
      for (let i = 0; i < race.riders.length && !bad; i++) {
        compared++;
        const got = get(race.riders[i]);
        if (Math.abs(got - exp[i]) > TOL)
          bad = { f: s.f, t: (s.f / (1 / CFG.fixedDt)).toFixed(1), rider: c.riders[i], field,
                  got, exp: exp[i], off: got - exp[i] };
      }
      if (bad) break;
    }
    if (bad) break;
  }
  if (bad) {
    console.log('  ' + tag + ': FIRST DIVERGENCE at frame ' + bad.f + ' (t=' + bad.t + 's)');
    console.log('      rider ' + bad.rider + '  ' + bad.field
      + '  got ' + bad.got + '  expected ' + bad.exp + '  off by ' + bad.off.toExponential(2));
    fails++;
  } else {
    console.log('  ' + tag + ': ok, ' + c.samples.length + ' samples matched'
      + (c.gears ? ' (gears on)' : ''));
  }
}

console.log('---');
if (fails) {
  console.log('FAIL: ' + fails + ' problem(s). If the sim changed on purpose, regenerate:');
  console.log('  node tools/extract.js && node tools/port-export.js');
  process.exit(1);
}
console.log('PASS: port/ matches this sim (' + compared.toLocaleString() + ' value comparisons, tol '
  + TOL + ')');
