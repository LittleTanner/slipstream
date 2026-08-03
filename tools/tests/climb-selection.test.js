// MECHANIC: climbing selection. Promise: terrain selects the specialist. The BODY is
// what carries identity (parts are only a ~35% tune on top), so this compares a
// climb-grown body against a sprint-grown body — dominance's own DIM_BODY numbers —
// on the queen stage and the pan-flat stage. Two seeds, summed places.
const Sim = require('../sim.js');
const { CFG } = Sim;
const BODY = {
  climb: { climbCost: -0.22 },
  sprint: { kick: 0.14, attack: 0.07 },
};
function place(bodyKey, seed, stageIndex, plan) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed, stageIndex, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  race.you.stats = Sim.buildStats(Sim.neutralBuild());
  for (const [k, v] of Object.entries(BODY[bodyKey]))
    race.you.stats[k] = (race.you.stats[k] === undefined ? 0 : race.you.stats[k]) + v;
  race.you.you = false;
  race.you.plan = { k: plan, at: 0.30, kick: 200 };
  let g = 0; while (!race.you.finished && g++ < 120 * 700) Sim.step(race, CFG.fixedDt, null);
  return Sim.settle(race).find(x => x.name === 'YOU').place;
}
const SEEDS = [37, 52];
const sum = (body, si, plan) => SEEDS.reduce((a, s) => a + place(body, s, si, plan), 0);
const climberQueen = sum('climb', 4, 'climb'), sprinterQueen = sum('sprint', 4, 'climb');
const sprinterFlat = sum('sprint', 3, 'sprint'), climberFlat = sum('climb', 3, 'sprint');
console.log('queen (sum of ' + SEEDS.length + ' places): climb-body ' + climberQueen + ' vs sprint-body ' + sprinterQueen
  + '  |  panflat: sprint-body ' + sprinterFlat + ' vs climb-body ' + climberFlat);
if (climberQueen >= sprinterQueen) { console.log('FAIL: a climbing body does not beat a sprint body on the queen stage'); process.exit(1); }
if (sprinterFlat >= climberFlat) { console.log('FAIL: a sprint body does not beat a climbing body on the pan-flat stage'); process.exit(1); }
console.log('PASS: terrain selects the right specialist');
