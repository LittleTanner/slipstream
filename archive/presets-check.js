// Preset validation. Races each preset (and a junk build) across every stage template,
// ridden under the plan that terrain invites, driven by the sim's own AI (so cornering,
// climbing, sprinting all count). Proves the design's core promises:
//   - a specialist WINS its terrain and TANKS on the wrong one (specialization pays,
//     and the wrong build for the tour genuinely sucks)
//   - the junk build is good nowhere
// Score is finishing place (lower = better); ~1-3 is a real result, 8+ is dropped.
const Sim = require('../tools/sim.js');
const P = require('../tools/parts.js');
const R = require('./presets.js');

const TEMPLATES = [0, 1, 2, 3, 4];
const TNAME = ['flat', 'hills', 'mtn', 'panflat', 'queen'];
const SEEDS = [11, 23, 37, 52, 68];
const TERRAIN_PLAN = ['sprint', 'diesel', 'climb', 'sprint', 'climb'];
const DIV = 4;

function place(build, seed, si) {
  const gc = {}; for (const nm of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[nm] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed, stageIndex: si, playerType: 'rouleur', gc, leaders: {}, div: DIV });
  race.you.stats = P.buildStats(build);
  race.you.you = false;
  race.you.plan = { k: TERRAIN_PLAN[si], at: 0.30, kick: 200 };
  let g = 0; while (!race.you.finished && g++ < 120 * 600) Sim.step(race, Sim.CFG.fixedDt, null);
  const order = Sim.settle(race);
  return order.find(o => o.name === 'YOU').place;
}
function avgPlace(build, si) { let s = 0; for (const seed of SEEDS) s += place(build, seed, si); return s / SEEDS.length; }

const builds = Object.assign({}, R.PRESETS, { Junk: R.JUNK });
console.log('preset'.padEnd(10) + TNAME.map(x => x.padStart(9)).join('') + '   label');
for (const nm of Object.keys(builds)) {
  const row = TEMPLATES.map(t => avgPlace(builds[nm], t));
  console.log('  ' + nm.padEnd(8) + row.map(v => v.toFixed(1).padStart(9)).join('') + '   ' + R.deriveArchetype(builds[nm]));
}
console.log('\nRead: each preset should have terrain it wins (low) and terrain it suffers (high).');
console.log('Climber → mtn/queen; Sprinter → flat/panflat; Puncheur → hills; Rouleur → even; Junk → poor everywhere.');
