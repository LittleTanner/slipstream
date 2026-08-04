// MECHANIC: committed attacks. Promise: an AI attack is a committed EVENT — wound up,
// held for seconds, then a long cooldown — never a per-frame flicker (which cannot be
// telegraphed or followed).
const Sim = require('../sim.js');
const { CFG } = Sim;
const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
const race = Sim.createRace({ seed: 21, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
const c = race.course;
for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
const raider = race.riders.filter(o => !o.you)[0];
raider.plan = { k: 'raid', at: 0.08, kick: 400 };
for (const o of race.riders.filter(o => !o.you).slice(1)) o.plan = { k: 'raid', at: 0.99, kick: 400 };
let episodes = [], cur = null, armed = false;
for (let g = 0; g < 120 * 120; g++) {
  Sim.step(race, CFG.fixedDt, { rate: 2.5, ease: false, launch: false, stumble: false, tx: race.you.x });
  const t = g / 120;
  if (t < 15) continue;                       // skip the pace-car bumper scramble window
  const attacking = raider.eff === 'attack';
  // An attack already UNDERWAY when the window opens is truncated at the head, exactly as
  // one still open at the end is truncated at the tail, and its clipped length reads as a
  // flicker. Wait for one clean non-attacking frame before counting anything.
  if (!attacking) armed = true;
  if (!armed) continue;
  if (attacking && !cur) cur = { start: t };
  if (!attacking && cur) { cur.end = t; episodes.push(cur); cur = null; }
  while (race.events.length) race.events.shift();
}
// an episode still open at the window's end is truncated, not a flicker — drop it
const durs = episodes.map(e => e.end - e.start);
const gaps = episodes.slice(1).map((e, i) => e.start - episodes[i].end);
console.log('attack episodes after 15s: ' + episodes.length + '  durations: ' + durs.map(d => d.toFixed(1)).join(',') + '  gaps: ' + gaps.map(x => x.toFixed(1)).join(','));
if (episodes.length < 1) { console.log('FAIL: the raider never attacked in its window'); process.exit(1); }
if (durs.some(d => d < 1.8)) { console.log('FAIL: an attack flickered (< 1.8s) — attacks must be committed'); process.exit(1); }
if (gaps.some(x => x < 7)) { console.log('FAIL: attacks re-fired within cooldown (< 7s apart)'); process.exit(1); }
if (episodes.length > 6) { console.log('FAIL: ' + episodes.length + ' attacks in 105s is flicker, not racing'); process.exit(1); }
console.log('PASS: attacks are committed events with real cooldowns, never flicker');
