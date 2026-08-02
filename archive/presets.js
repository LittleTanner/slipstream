// Preset builds (one-tap onramps) + archetype derivation. The four presets each fill
// the six slots leaning an archetype; deriveArchetype() replicates the view layer's
// riderProfile so the label matches the radar the player sees. Validated by the harness.
const Sim = require('../tools/sim.js');
const P = require('../tools/parts.js');

const PRESETS = {
  Climber:  { frame: 'carbon', wheels: 'box',  gearing: 'compact',  position: 'upright', tires: 'slick',    engine: 'diesel' },
  Sprinter: { frame: 'steel',  wheels: 'disc', gearing: 'big',      position: 'slammed', tires: 'slick',    engine: 'punch'  },
  Rouleur:  { frame: 'alloy',  wheels: 'disc', gearing: 'standard', position: 'slammed', tires: 'slick',    engine: 'diesel' },
  Puncheur: { frame: 'carbon', wheels: 'box',  gearing: 'big',      position: 'endur',   tires: 'grip',     engine: 'punch'  }
};

// A deliberately bad build: trades chosen to fight, not help — big-block gearing on a
// climb, aero position with no engine, grippy draggy tires. Used to prove "you can
// build a rider that sucks" is real and fair.
const JUNK = { frame: 'carbon', wheels: 'box', gearing: 'big', position: 'upright', tires: 'grip', engine: 'diesel' };

const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const n = (v, lo, hi) => cl((v - lo) / (hi - lo), 0, 1);
const inv = (v, lo, hi) => cl((hi - v) / (hi - lo), 0, 1);
function axes(build) {
  const s = P.buildStats(build);
  return {
    climb:   inv(s.climbCost, 0.65, 1.35),
    sprint:  (n(s.attack, 1.15, 1.40) + n(s.kick, 0.92, 1.16)) / 2,
    endure:  (n(s.recover, 0.95, 1.25) + n(s.resilience, 0.90, 1.25)) / 2,
    wind:    (inv(s.windTax, 0.70, 1.15) + n(s.draft, 0.90, 1.20)) / 2,
    descend: (n(s.descend, 0.90, 1.15) + n(s.handling, 0.85, 1.25)) / 2,
    feed:    (n(s.gut, 0.85, 1.40) + n(s.reach, 0.95, 2.20) + inv(s.fuelUse, 0.85, 1.15) + inv(s.sweatRate, 0.80, 1.15)) / 4
  };
}
// Thresholds are set in a second pass, once the axis numbers for the presets are known.
function deriveArchetype(build) {
  const a = axes(build);
  const hiClimb = a.climb > 0.58, hiSprint = a.sprint > 0.58;
  if (hiClimb && hiSprint) return 'Puncheur';
  if (hiClimb && a.climb - a.sprint > 0.12) return 'Climber';
  if (hiSprint && a.sprint - a.climb > 0.12) return 'Sprinter';
  return 'Rouleur';
}
module.exports = { PRESETS, JUNK, axes, deriveArchetype };
