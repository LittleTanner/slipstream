// ARCHIVED FIRST DRAFT — do not require from the live tools. The tuned tables now
// live inside the Sim (tools/parts.js is a shim over them); ten of these twelve
// non-neutral parts were rescaled or reshaped before shipping.
// Slipstream rider redesign — part-effect model (step 1, headless, no UI).
// Six component slots, three distinct named parts each. Every part is a TRADE:
// deltas from the neutral base, described in cycling terms. There is no points
// budget — the trades themselves are the cap. Balance is enforced by the dominance
// harness, never by hand-waving. Numbers here are a FIRST DRAFT to be tuned by the
// harness.
const Sim = require('../tools/sim.js');
const BASE = Sim.BASE_STATS;

const SLOTS = ['frame', 'wheels', 'gearing', 'position', 'tires', 'engine'];

// Each slot: two mild opposing leans + one extreme specialist (unlocked later).
// `neutral:true` marks the do-everything option used as the control in the harness.
const PARTS = {
  frame: [
    { id: 'steel',  name: 'Steel',  lean: 'endure', note: "Heavy, but soaks up the road and never lets go",
      d: { resilience: +0.10, recover: +0.04, climbCost: +0.05 } },
    { id: 'alloy',  name: 'Alloy',  neutral: true, note: "The honest all-rounder: good everywhere, best nowhere",
      d: {} },
    { id: 'carbon', name: 'Carbon', lean: 'climb', extreme: true, note: "Feathery and stiff uphill, punishing when it turns rough",
      d: { climbCost: -0.19, resilience: -0.07 } }
  ],
  wheels: [
    { id: 'box',  name: 'Box section', lean: 'descend', note: "Light and sure-footed, but no shelter from the wind",
      d: { handling: +0.08, descend: +0.06, windTax: +0.05 } },
    { id: 'mid',  name: 'Mid depth',   neutral: true, note: "A bit of everything, nothing to fear",
      d: { windTax: -0.03 } },
    { id: 'disc', name: 'Deep / disc', lean: 'wind', extreme: true, note: "Slippery in a straight line, a handful when it blows across",
      d: { windTax: -0.13, draft: +0.07, handling: -0.13, descend: -0.05 } }
  ],
  gearing: [
    { id: 'compact', name: 'Compact',   lean: 'climb', note: "Spins up the steep stuff, gives away the top end",
      d: { climbCost: -0.13, kick: -0.03 } },
    { id: 'standard', name: 'Standard', neutral: true, note: "Ratios for any road",
      d: {} },
    { id: 'big',     name: 'Big block', lean: 'sprint', extreme: true, note: "A monster sprint, a millstone on the climbs",
      d: { kick: +0.12, attack: +0.05, climbCost: +0.16 } }
  ],
  position: [
    { id: 'upright', name: 'Upright',       lean: 'control', note: "Comfortable and in control, but it catches the wind",
      d: { handling: +0.06, recover: +0.04, windTax: +0.06 } },
    { id: 'endur',   name: 'Endurance fit', neutral: true, note: "A sane compromise between fast and rideable",
      d: { windTax: -0.02 } },
    { id: 'slammed', name: 'Slammed',       lean: 'wind', extreme: true, note: "Knifes the wind, murder on the back and the handling",
      d: { windTax: -0.12, handling: -0.07, recover: -0.05 } }
  ],
  tires: [
    { id: 'slick',    name: 'Race slick',       lean: 'speed', note: "Fast and light, but nothing in reserve when it gets loose",
      d: { windTax: -0.07, climbCost: -0.02, descend: -0.05, handling: -0.04 } },
    { id: 'allround', name: 'All-round',        neutral: true, note: "Grip and speed in fair measure",
      d: {} },
    { id: 'grip',     name: 'Grippy tubeless',  lean: 'descend', note: "Sticks to anything, drags a little on smooth tar",
      d: { descend: +0.09, handling: +0.07, windTax: +0.05 } }
  ],
  engine: [
    { id: 'diesel',   name: 'Diesel legs',    lean: 'endure', note: "Rolls all day and recovers, with no explosive kick",
      d: { recover: +0.08, resilience: +0.06, kick: -0.05, fuelUse: -0.03 } },
    { id: 'allround', name: 'All-round legs', neutral: true, note: "A balanced engine",
      d: {} },
    { id: 'punch',    name: 'Fast twitch',    lean: 'sprint', extreme: true, note: "A vicious kick and attack, but it burns fuel and fades",
      d: { kick: +0.10, attack: +0.07, fuelUse: +0.06, recover: -0.04 } }
  ]
};

function buildStats(build) {
  const s = Object.assign({}, BASE);
  for (const slot of SLOTS) {
    const part = PARTS[slot].find(p => p.id === build[slot]) || PARTS[slot].find(p => p.neutral);
    for (const [k, v] of Object.entries(part.d || {})) s[k] = (s[k] === undefined ? 0 : s[k]) + v;
  }
  return s;
}
function neutralBuild() {
  const b = {};
  for (const s of SLOTS) b[s] = (PARTS[s].find(p => p.neutral) || PARTS[s][0]).id;
  return b;
}
module.exports = { SLOTS, PARTS, buildStats, neutralBuild };
