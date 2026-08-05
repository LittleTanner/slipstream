// DOES ANYONE GO WITH YOU WHEN YOU ATTACK FROM A BREAKAWAY?
//
// Kevin's report was that attacks are restricted inside a break. Measured, they are not:
// break riders attack on 8.3% of frames against the peloton's 8.8%, so nothing blocks the
// effort. What was missing was the REACTION. Every trigger in `aiThink` that answers
// something — follow the player's dig, chase a break — required `r.inPeloton`, so a break
// was a place where a dig went unanswered and getting company was pure coincidence.
//
// This measures the reaction directly: the player attacks from inside the break, and we count
// how often a break RIVAL goes from not-attacking to attacking within a couple of seconds.
// Run against both sims so the change is attributable rather than assumed:
//
//   node tools/breakreact.js
//   BR_SIM=/path/to/oldsim.js node tools/breakreact.js
const Sim = require(process.env.BR_SIM || './sim.js');
const P = require('./parts.js');
const { CFG } = Sim;

const SEEDS = [11, 23, 37, 52, 71, 89];
const STAGES = [0, 1, 2];
const DIVS = [8, 4, 1];
const WINDOW = 2.0;                       // seconds a "response" is allowed to take

// The player rides a raid so they end up in a break, then attacks INSIDE it. Driven by the
// sim's own AI for everything except the attack, so the race around them is a real race.
function run(seed, stageIndex, div) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed, stageIndex, playerType: 'rouleur', gc, leaders: {}, div });
  const you = race.you;
  you.stats = P.buildStats(P.neutralBuild());
  you.you = false;
  you.plan = { k: 'raid', at: 0.22, kick: 200 };
  // ★ A CONTROL WINDOW, OR THIS MEASURES NOTHING. Break riders attack on their own plans
  // about 8% of the time, so "did any rival start attacking in the next two seconds" comes up
  // true constantly by coincidence: the first version of this reported 29% answered both
  // before and after the change, which is the base rate and not a reaction. So sample the
  // SAME question at moments when the player is sitting in the break NOT attacking. The
  // difference between the two rates is the only part that is the mechanic.
  let wasAtk = false;
  let digs = 0, answered = 0, ctrl = 0, ctrlAnswered = 0, brkFrames = 0, brkAtkFrames = 0;
  const open = [];                        // { until, rivals, isDig }
  let g = 0, ctrlCooldown = 0;
  while (!you.finished && g++ < 120 * 900) {
    Sim.step(race, CFG.fixedDt, null);
    if (g % 6) continue;                  // 20 Hz sampling is plenty for a 2s window
    const t = race.clock;
    const brk = race.breakaway || [];
    const youIn = brk.indexOf(you) >= 0;
    const rivals = brk.filter(r => !r.you && !r.finished && !r.out);
    for (const r of rivals) { brkFrames++; if (r.eff === 'attack') brkAtkFrames++; }
    // Resolve anything already open first, so a window opened this tick cannot be answered
    // by a rider who was already attacking when it opened.
    for (let i = open.length - 1; i >= 0; i--) {
      const w = open[i];
      if (w.rivals.some(r => r.eff === 'attack')) {
        if (w.isDig) answered++; else ctrlAnswered++;
        open.splice(i, 1);
      } else if (t > w.until) open.splice(i, 1);
    }
    if (youIn && rivals.length >= 1) {
      // A DIG IS A JUMP, matching the mechanic. Inside a break `eff === 'attack'` is the
      // normal hard state, not a dig — keying on it is what made the first version of this
      // change fire on every frame of ordinary through-and-off and kill the rotation.
      const nowAtk = (you.burst || 0) > 0.12;
      const idle = rivals.filter(r => r.eff !== 'attack');
      // Rising edge only: one burst is one dig, not forty samples of it decaying.
      if (nowAtk && !wasAtk && idle.length) { digs++; open.push({ until: t + WINDOW, rivals: idle, isDig: true }); }
      // A CONTROL is the player in the break, not attacking, with idle company — the same
      // question asked when nothing has happened. Cooled down so the windows do not overlap
      // and inflate the baseline.
      if (!nowAtk && idle.length && ctrlCooldown <= 0) {
        ctrl++; open.push({ until: t + WINDOW, rivals: idle, isDig: false });
        ctrlCooldown = WINDOW;
      }
      ctrlCooldown -= 6 / 120;
      wasAtk = nowAtk;
    } else { wasAtk = false; ctrlCooldown = 0; }
  }
  return { digs, answered, ctrl, ctrlAnswered, brkFrames, brkAtkFrames };
}

let D = 0, A = 0, C = 0, CA = 0;
console.log('a rival starts attacking within ' + WINDOW + 's of ... your dig, vs ... nothing');
console.log('  ' + 'div'.padEnd(5) + 'digs'.padStart(7) + 'answered'.padStart(10) + 'rate'.padStart(7)
  + '  |' + 'controls'.padStart(10) + 'rate'.padStart(7) + '  |    LIFT');
for (const div of DIVS) {
  let d = 0, a = 0, c = 0, ca = 0;
  for (const seed of SEEDS) for (const si of STAGES) {
    const r = run(seed, si, div);
    d += r.digs; a += r.answered; c += r.ctrl; ca += r.ctrlAnswered;
  }
  D += d; A += a; C += c; CA += ca;
  const dr = d ? 100 * a / d : 0, cr = c ? 100 * ca / c : 0;
  console.log('  ' + String(div).padEnd(5) + String(d).padStart(7) + String(a).padStart(10)
    + (dr.toFixed(0) + '%').padStart(7) + '  |' + String(c).padStart(10)
    + (cr.toFixed(0) + '%').padStart(7) + '  |' + ((dr - cr >= 0 ? '+' : '') + (dr - cr).toFixed(0) + ' pts').padStart(9));
}
const DR = D ? 100 * A / D : 0, CR = C ? 100 * CA / C : 0;
console.log('  ---');
console.log('  overall: digs ' + A + '/' + D + ' = ' + DR.toFixed(0) + '%,  controls '
  + CA + '/' + C + ' = ' + CR.toFixed(0) + '%,  LIFT ' + (DR - CR >= 0 ? '+' : '') + (DR - CR).toFixed(0) + ' points');
console.log('\nTHE LIFT IS THE MEASUREMENT. The raw answered rate is mostly the base rate at which');
console.log('break riders attack on their own plans, which is why the first version of this read');
console.log('29% both before and after the change. It should never reach 100%: going alone has to');
console.log('stay possible or a break is just a rolling bunch.');
