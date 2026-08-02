# Slipstream — rider redesign (build your bike)

Design contract for the v1 rider system. This **replaces** two earlier decisions:
the "fit 2 of 6 upgrades per section" model and the dial/ladder split. The shop work
already shipped (radar, off-radar meters, card UI, segment picker) is kept and becomes
the readout surface for this system.

Everything here is v1, to be ported to iOS. Settle it in the HTML prototype first,
because it changes how a rider's stats are assembled and forces a deliberate
golden-master regeneration.

---

## The core

You build your whole bike from scratch. **Six component slots**, one part chosen per
slot. Provisional slots: frame, wheels, tires, gearing, position, contacts. The final
slot list is the first thing to lock when this is specced; the number six is the
target, not sacred.

Bike and body fold into these six slots as one physical build, one surface. Tactics
(radio, power meter, sticky bottle, feeds) stay a **separate layer on top**, unchanged
by this redesign.

### No budget number

There is no visible points budget. The parts themselves are the cap: **every part is a
trade, so you physically cannot be good at everything.** Picking a light climbing frame
costs durability; deep wheels cost crosswind handling. The player never sees a total;
they see six components with pros and cons and read the result off the radar.

This is the balance lever. It never inflates through play. "Minimalist in look, not in
features" — the depth is in the combinations, carried visually by the radar and meters,
not by an on-screen number.

---

## Slot design (the real work)

Each slot has **three distinct named parts that are different trades, not tiers.** Not
weak / medium / strong — three genuinely different bikes, where the best one depends on
the tour. Example, frame slot:

| Part | Good at | Pays with |
|---|---|---|
| Steel | forgiving, durable | heavy |
| Alloy | neutral, do-everything | nothing special either way |
| Carbon | light, sharp uphill | fragile, harsh ride |

Two hard constraints on every slot:

1. **Trades must cross radar axes.** A climbing frame trades climb for durability;
   climbing wheels trade climb for wind. Going max-climb in every slot must produce a
   rider who is fragile *and* exposed *and* can't descend — a lopsided rider, never a
   superior one. If two parts in a slot trade on the same axis, one will dominate.
2. **No part may be a no-brainer regardless of tour.** With no budget forcing a cost,
   the only thing preventing a dominant part is the sim. This is what the dominance
   harness (below) exists to catch.

Slots follow a **mild-A / mild-B / one-extreme** shape: the two mild parts already lean
toward two different archetypes, and the extreme is the specialist payoff unlocked
later. This is what lets the archetype split work from the very first race (see Start
state).

---

## Progression

Progress is **unlocking distinct parts with prize money, never raising a ceiling.**
Same structure throughout; unlocks give more *range*, not more total.

- Early game: your parts are mild, so the radar is a soft blob no matter how you build.
- Later: with the same structure, unlocked specialist parts let you push a trade to its
  extreme and build a knife — a radar spiked hard where it couldn't spike before.
- A Division 8 rider and a Division 1 rider are a **range gap, not a power gap.** The pro
  doesn't have more; they can express more with the same.

Felt progress = fitting a newly unlocked part and watching the radar spike somewhere it
couldn't reach before. The part is the reward; the radar spike is the feedback.

### Start state (Option A)

Begin with the **mild parts unlocked** — enough to build any of the three archetypes,
gently, from the very first race. Earn the **extreme specialist parts** by winning. So
the floor is "any archetype, softly," not "generalist only," and the unlock reward is
always "sharper," never a sidegrade presented as progress.

### Division scaling lives on the rivals, not the player

The player's build ceiling does **not** scale with division. Difficulty up the ladder
comes from conditions (wind, corners, team-car margins, tour length) and from **rivals
getting sharper, better parts by division.** The field genuinely gets faster and better
as you climb — matching real cycling — while your own build stays a stable thing you
reason against. This keeps the two difficulty curves from stacking and keeps raw power
off the player's side, where uncapped power was cut on purpose.

---

## Commit per tour

Committing a build is a **hard lock for the whole tour** — presets included. The only
future exception is a time-trial stage (when it exists), which would allow a re-spec.

The build screen **must show the full tour profile** — stage types, where the summits
and sprints fall — before you lock. Committing blind is punishing; committing against a
profile you can read is strategic. Reuse the existing profile strip.

Free per-stage refit is gone. Your physique is set for the race; you adapt tactics
between stages, not your frame. This is what makes a build a real bet and a bad build
actually bite.

---

## Archetype = a readout, not a choice

The player does not pick a rider type. Their six picks sum to a radar shape, and the
game **labels** it: climb/endure-heavy reads climber, sprint/kick-heavy sprinter,
balanced rouleur. The label never gates prize money or matchmaking — the moment it does,
it inherits a pile of edge cases.

**Four presets** offered as one-tap onramps: climber, sprinter, rouleur, and the
player's custom / last build. A preset just fills the six slots, then commits exactly
like a custom build. No swappable-preset special case.

---

## Rivals

Majority **standard archetypes** as the honest baseline field, plus **a few sharp custom
builds shaped by the parcours** — a mountain tour fields specialist climbers because
that's who'd target it. Crucially, custom rivals are **stage-shaped, not player-shaped**:
they are not built to counter your build. Countering the player would neutralise the
commit-per-tour bet every time and feel awful.

Rivals get sharper parts by division. The custom-rival set is **seeded** so a given
seeded tour or daily fields the same rivals for everyone — determinism is load-bearing,
and "adaptive" must not sneak in per-run randomness.

---

## Daily challenge

Everything unlocked, all parts available to everyone, four presets offered. Fair by
construction: there is no budget to inflate, so "everything unlocked" gives nobody more
power, only more shape. Parcours-shaped rival builds keep the field diverse instead of
converging on one meta, which also spreads finishing times and reduces ties.

---

## "You can build a rider that sucks"

Intended feature. A bad rider is one whose six trades **fight the tour they drew** (full
aero on a summit finish). It is fair and visible — the radar shows the lopsidedness —
and free to undo before you commit. Once committed, it is locked. This is the mechanism
that makes bad builds real without a points meter: sucking is misreading the parcours,
not overspending.

---

## Part descriptions

Cycling terms, catalogue voice, describing the component and its feel — e.g. "supple
30mm tubeless, grips and rolls, but no protection when it's rough." **Never** "better for
climbing." What a part does to you is read only off the radar. Same principle as the
riding-data screen: state the thing, never the verdict; the radar is the verdict surface.

---

## Balance and the dominance harness

Budget-less balance is **harder** to verify, not easier — there is no total to constrain
it. Before the port this needs:

- A **part-dominance test harness**: a headless sim that plays every part across the
  stage templates and flags any part that wins regardless of parcours. Built in HTML,
  leaned on every time a part is added or tuned.
- A **deliberate golden-master regeneration**, with a commit note, once the trade tables
  are set — because this changes the stat assembly.

---

## Build sequence

1. **Part-effect model + dominance harness, headless, no UI.** Define the six slots and
   eighteen parts as stat-trade tables, wire them into the existing stat assembly, and
   get the eighteen trades balanced before a single pixel. The design lives or dies here.
2. **Commit-per-tour flow + build screen**, reusing the shipped radar and meters as the
   whole readout, plus the tour profile at lock time.
3. **Progression / unlock order** — mild parts start unlocked, specialists earned.
4. **Rivals** — parcours-shaped custom builds + division scaling, seeded.
5. **Reconfigure daily** to all-unlocked.
6. **Regenerate the golden master last**, deliberately, with a commit note.

Radio and power meter (the tactics layer) are untouched by this and can be finished
first as a palate cleanser.

---

## Open items to settle when specced

- The final six slot list and what each slot's two poles trade (the actual eighteen
  parts and their stat tables). This is step 1 and the heart of the design.
- Ceiling starts at **3 parts per slot (18 total)**; expand a slot only if it feels thin.
