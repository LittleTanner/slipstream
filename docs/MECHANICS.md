# Slipstream — every mechanic, and how to test it

The map for targeted improvements: what each mechanic promises, where it lives in the
sim (a search string for `tools/sim.js` after `node tools/extract.js`), and the fastest
way to check you have not broken it.

## The three test tiers

1. **`node tools/tests/run.js` — the mechanics suite (~30s).** One focused test per
   mechanic promise. A failure NAMES the mechanic that broke. Run it after every sim
   edit; it is the first thing to consult before the slower tiers.
2. **`node tools/verify.js` — the golden master (1590 checks, ~1 min).** Catches ANY
   behavioral drift, but says only "something moved", not what. A deliberate physics
   change fails it by design; regenerate with `tools/golden-gen.js` + a note.
3. **`node tools/dominance.js` — parts balance (~1.5 min on worker threads).** 0
   dominant, 0 dead is the goal; `DOM_SERIAL=1` forces the byte-identical serial
   reference. **The dead-count is not stable even at six seeds**, on any sim: the same
   build measures 0 dead on one six-seed set and 1 on another, and casualty lists barely
   overlap between sets. So treat a dead verdict as real only if it REPEATS ACROSS SEED
   SETS (`DOM_SEEDS=11,23,37,52,71,89` then `DOM_SEEDS=13,29,41,58,77,91`), and use
   `DOM_SIM=/path/to/other-sim.js` to run the same grid against the sim before your
   change so the verdict is attributable rather than assumed. Structural blind spot: it
   rides ONE stage, so a part whose value is "you are fresher tomorrow"
   (`fatigueResist`) cannot register at all.
4. **`node tools/ladder.js` — the ladder's shape (~4 min on worker threads).** Grids
   DIVISION against PLAYER DEVELOPMENT. Two numbers matter: **GAIN** (places won by
   growing, at a fixed division — no column should be flat, or the career is decoration)
   and **ON PATH** (you arrived at each division developed for it — should stay the same
   contest all the way up). Run it after anything touching `tierProfile`, `rivalBody` or
   rider growth. `LAD_SEEDS=...` widens it. `tools/sweep-ladder.js` runs candidate
   changes against patched copies of the sim so you can compare before editing the game.
5. **`node tools/outlook.js` — is a number worth showing?** Not a balance gate. It prints
   what the power meter's readout SAYS (seconds until the legs are gone) across gradient,
   shelter and climbing body, so a readout can be shown to differ before it is sold as a
   tactic. Two harness traps it hit, both of which silently read as "the feature does
   nothing": `course.grades` is a FLAT ARRAY OF NUMBERS indexed by distance/STEP, so
   writing `{d, g}` markers into it lerps two objects into NaN; and the sim's grade is not
   a percent (`displayed % = g * CFG.gradePct`, gradePct 15), so a literal `0.09` is a
   1.35% drag rather than a wall. Shelter cannot be pinned by setting `q` — it is
   recomputed every substep — so pin a hare on the wheel-line the way `tt.test.js` does.
6. **Browser suites** — `python3 tools/browser/smoke.py` (~2 min: every screen, every
   drill, a daily-challenge start on today's real course, the team car's whole
   arrive-change-pull-tow life cycle, a shrunk race end to end, the pause card) and
   `python3 tools/browser/career.py` (~2 min: division display, route-pack pricing
   ladder, money, result recording, all against seeded saves). These cover the VIEW —
   the dead-button / unregistered-screen / CSS-specificity class of bug the sim tests
   cannot see.

CI runs tiers 1, 2 and 6 on every PR (the browser suites as a parallel job, so they do
not slow the golden down). Tiers 3, 4 and 5 are manual: dominance after anything touching AI
behavior, effort, or drafting (box-section wheels are the canary), and ladder after
anything touching division difficulty or growth.

One hard-won rule for tier 4: **whatever weakens the mid-ladder field re-tunes the second
chance**, whose balance is calibrated against the bunch's pace. Re-measure that chase
across seeds and BOTH wheel-change qualities before believing any ladder change is free.

And one for tier 1: **the mechanics suite does NOT guard the swing constants.** `swingCut`
0.09 to 0.12 leaves all 38 tests green and breaks the golden, money included, because the
drill's `hold()` clamps a swinging AI to 90% of your speed and four test files copy that
clamp verbatim. Verify `swingCut`, `swingLen` and `turnLen` against the GOLDEN. See
DECISIONS.md, "The mechanics suite gives a false green on the swing constants".

---

## Aerodynamics

| Mechanic | Promise | Sim anchor | Test |
|---|---|---|---|
| Drafting (q) | Sitting on a wheel is cheaper than clean air; shelters compound in a pack, they do not shadow | `let through = 1, bq = 0` | `draft.test.js` |
| Crosswind shelter | The shelter sits off to the LEEWARD side of the wheel, not behind it | `shelterOff` | `crosswind.test.js` |
| Head/tail wind | Headwind holds you up, tailwind pushes, shelter blunts both | `TAILWIND PUSHES` | `wind.test.js` |
| Peloton mass shelter | Deep in the bunch is the cheapest place on the road; a lone leader does real work | `sheltered by the mass` | `mass-shelter.test.js` |
| Pace car slipstream | For seconds after the flag the car's hole can sling a rider clear; rivals race you for the bumper | `THE PACE CAR'S SLIPSTREAM` | `pacecar.test.js` |
| Team car tow | The car paces you back after a mechanical; drift out of its draft and it leaves you | `towSpeed` in CFG | `teamcar.test.js` |
| Team car continuity (view) | ONE car does the whole job: drives up from behind, sits alongside for the wheel, pulls through in front, tows you, then drops away. Never two cars, never a restarted run-up | `ONE CAR, ONE JOB` | `browser/smoke.py` teamcar flow |

## The rotation (through and off)

The most player-facing mechanic; it has its own suite. All of it lives in
`updateGroups` (anchor `THROUGH AND OFF`).

| Piece | Promise | Test |
|---|---|---|
| Turn cue order | YOUR TURN only when the front's pull is done AND you are next in the working file | `rotation-cue.test.js` |
| Saving | `window.storage` is defined by the page when the host does not provide one, backed by `localStorage`, probed with a real write (it THROWS rather than returning null when blocked) and falling back to an in-memory Map. Never clobbers an injected or host-provided store. **It was read in four places and defined in none until build 34**, so a browser silently discarded every save and the career reset on reload; the try/catch hid it and the test shim hid it harder. The diagnostics page's first row names the live store | `career.py` case "save: the game can save with no shim" - deliberately does NOT inject the shim, and proves it by reloading |
| Swing-off + rejoin | A relieved rider swings aside, drifts outside the file, tucks in ON the last wheel, never mid-file, never colliding | `rotation-rejoin.test.js` |
| The queue | You are only called again once you have BEEN TO THE BACK since your last pull; a shirking mate waives that after a full cycle | `rotation-recall.test.js` |
| Cohesion | The working rotation is the cohesive chain at the head of the break (gaps > 10 m break it); a companion you dropped keeps no rotation alive and no cue fires while you are functionally alone | `rotation-cohesion.test.js` |
| Drop-back | Soft-pedalling after your pull peels you off the train in ~3-4s and puts you CLEAR OF CONTACT RANGE (2.2 m, against `HIT_LON` 1.9), so you can move back into line without riding into the wheel you dropped behind. `CFG.easeCut` (0.45), deliberately NOT `swingCut` (0.09), because a rival's swing is an automatic drift and yours is a decision. Self-terminating: the cap lifts the instant you are clear | `rotation-dropback.test.js` |
| AI drop-back | A rival drops from the front to behind the last wheel in a median **3.17s**, worst 4.83s, against the player's 3.3s / 8.9s. So rivals are slightly faster than you and there is **no tail**. TWO retracted figures, both this harness rather than the game: "median 11.91s" timed contiguous runs of `swingOff` (re-armed by three paths), and "worst 39.07s" started its clock on `breakFront` changing in breaks that were NOT ROTATING, where nothing is dropping back at all. A drop-back is a rotation event, so a window that outlives the rotation is not a slow drop-back. A distance-budget alternative sits behind `CFG.swingBudget` (off) and measures worse: 3.90s median, 28.68s worst. `swingCut` above 0.12 breaks the wheel-suck escalation | `node tools/aiswing.js` runs both rules; `refusal.test.js` is the only gate that sees a swing change |
| Wheel-suck escalation | Called and refusing: elbow flick, then the break sits up. Waiting your turn: never punished | `refusal.test.js` |
| Go-around | Easing on the front without moving aside gets you passed within seconds, not a stalled train | covered inside `rotation-dropback` / `refusal` |

Known gap, accepted by decision (DECISIONS.md, "Rejected, with reasons"): breaks of
4-6 riders never rotate, because the group detector labels the largest group "the
peloton" and in an 8-rider field a 4+ break is always the largest group. Fixing it
means redefining the peloton (chase, driver, mass shelter all hang off the label).
Revisit only if fields grow beyond 8.

## Body and resources

| Mechanic | Promise | Sim anchor | Test |
|---|---|---|---|
| Legs (energy) | Efforts drain, easing recovers, on any terrain, in or out of shelter | `LEGS ALWAYS COME BACK` | `recovery.test.js` |
| Cracking / bonking | Empty legs cap your power hard; food debt caps it harder | `r.cracked`, `r.bonk` | `bonk.test.js` |
| Food (fuel) and stomach (absorb) | Eating fills a stomach that feeds you slowly; a full stomach climbs badly | `THE MUSETTE` | `stomach.test.js`, `feedzone.test.js` |
| Fluids and sweat | Dry riders fade and cannot attack | `dryPen` | `hydration.test.js` |
| Thin air | Above ~1200m altitude costs recovery and water, never raw power | `How thin the air is here` | `thin-air.test.js` |
| Rider growth / divisions | SIX dimensions grown by terrain (climb, sprint, endurance, durability, aero, handling); rivals harden on EVERY dimension by division, leaning into their archetype's and taking a 0.45 share of the rest, so the field stays competitive wherever you are | `race.D`, `rivalBody` | dominance (body-aware), `ladder.js` |
| The ladder's shape | Growing your body wins you places at every division (worst rung 1.17) AND the ladder stays roughly the same contest from Division 8 to Division 1 (on-path 4.11 to 5.15, drift +1.04). RE-MEASURED at build 31: the figures above were taken at build 16 and 27 commits had passed without anyone checking them, which matters because the golden CANNOT stand in here — it drives the player through `input` while ladder.js and dominance.js flip `you.you = false` and use the AI path, so a change to AI decisions (build 26) can move these while the golden stays green. Difficulty is the DAY getting longer and hillier, never the rivals getting free speed, because free speed is something the player can never earn AND steepening the climbs themselves would make a route pack the way to buy an easier Division 1 | `tierProfile` | `node tools/ladder.js` |
| Physique | Pro/con body traits: race weight (light climbs, heavy descends and sprints, and mass costs aero and food too) and muscle type. Neutral options are free, so a rider who owns nothing is still legal | `WEIGHTS`, `MUSCLES` | dominance + `career.py` |
| Training | Pure-positive blocks on an EARNED points budget rather than pro/con, because a career should let you simply get stronger; better blocks cost more points and what does not fit does not ride | `TRAINING`, `trainingBudget` | dominance + `career.py` |

## Terrain and handling

| Mechanic | Promise | Sim anchor | Test |
|---|---|---|---|
| Climbing | Gradient costs by climbCost; climbers break away on climbs; terrain selects the specialist | `climbMul` | `climb-selection.test.js` |
| Descending | Gravity coasts you down at any effort; soft-pedal scrubs it progressively (one brake, not two) | `GRAVITY on a descent` | `descending.test.js` |
| Handling vs speed | Slower means MORE steering authority (deliberately inverted); braking is the answer to a corner | `hardTurn` | `handling.test.js` |
| Corners / switchbacks | Carrying too much speed into a bend costs speed and can crash you; AI brakes by sharpness | `Brake for the corner` | `cornering.test.js` |
| Road furniture | Junctions, medians, roundabouts, narrows, surfaces, potholes; the hop clears holes and medians | `HOP A POTHOLE` | `road-furniture.test.js` (surfaces, narrows; the rest golden) |
| Crashes | Impact severity scales with speed and lean; in top divisions a bad one ends your race (+9999 sentinel) | `function impact` | `crash.test.js` (+ the golden sentinel case) |
| Second chance | ONE revival per crash-out race: wheel-change taps set the restart gap, the convoy's bumper drafts are the ladder back, and you must both USE the cars and pace it; catch the bunch or the broom wagon ends it for good. An unrevived race is bit-identical to before (verify passes with no regen) | `THE SECOND CHANCE` | `second-chance.test.js` |
| Cars are solid | A team car is a wall, not scenery: you are held at its bumper and carried at its pace until you steer around it. A position constraint, because bleeding closing speed (how riders hold each other off) let a rider grind straight through the bodywork | `A POSITION CONSTRAINT, NOT A SPEED PENALTY` | `second-chance.test.js` (head-on) |
| Punctures | A flat is a STOP; the team car and sticky bottle bring you back | `A puncture is a stop` | `puncture.test.js` |

## Racing furniture

| Mechanic | Promise | Sim anchor | Test |
|---|---|---|---|
| Attacks | Committed events: windup, go, cooldown; no per-frame flicker; rivals follow a genuine dig near the front | `Attacks are now committed` | `attacks.test.js` |
| Chase | The bunch chases a break it fears, harder late, sharper by division | `race.chase` | `chase.test.js` |
| Sprint lines | You may change your line, not into someone contesting; relegation costs points, money, a fine. **The corridor is only DRAWN while the rule can bite** (`r.lineLive`): a rider inside the `lineWatch` box and you within three of the lead. Alone off the front, or rolling in fifth, deviating costs nothing whatever you do, and drawing it anyway trains you to ignore it for the moment it matters. The watch box is deliberately WIDER than the offence's contact box, because a warning gated on contact arrives after the swerve it was meant to prevent. Decided in the sim where the rule lives, never re-derived in the view | `sprintLine`, `lineLive`, `CFG.lineWatch` | `sprint-line.test.js` (incl. penalised-implies-live, and not live when alone) |
| Bike throw | Timed right, most of a bike length; stretches you out after | `throwWindow` in CFG | `throw.test.js` |
| Primes | Sprint and KOM points on the road; summit finish = KOM and finish on one line | `nearestPrime` | `primes.test.js` |
| Feed zones | Food scattered along the road (deliberately not gating attacks); musettes hand up on a line; empties carried or littered | `musetteReach` in CFG | `feedzone.test.js` (items; musette line + litter golden) |
| Time trial | Start intervals, no-draft rule (yield when caught), time checks, cadence | `race.spec.tt` | `tt.test.js` (intervals, sheltering; checks + cadence golden) |
| Abandonment | Three-week tours shrink the field to ~75%; quitting a tour costs it | `ABANDONMENT` | `abandonment.test.js` |
| Finish roll-out | Riders ride THROUGH the line and coast, never parking on it; a finisher cannot speed-cap a sprinter still racing; the world lingers ~4 s after you cross | `RIDE THROUGH THE LINE` | `finish-rollout.test.js` |
| Bottle-drop placement | No drop zone before the first feed (no empty can exist yet); always one after the last feed | `Never before the first feed` | `litter-placement.test.js` |
| Groups | Peloton = largest group; break = riders 10+ clear of its head; ties resolve to the front group | `let peloton = groups[0]` | `groups.test.js` |
| Course generation | Integer PRNG, deterministic per seed; DERIVE values, never add an R() call mid-generation | `course feature factories` | `course-gen.test.js` (+ golden per-case fields) |
| Tours / GC / jerseys | Stage times sum into GC, points into green/polka, leaders derived and fed back per stage, fatigue carries | view glue: `finishStage` | `tour.test.js` |
| Parts and builds | FIVE slots (engine moved to the body), 4-5 trade parts each, 22 in all; balance enforced by the harness, never by hand | `const PARTS` | dominance |
| Race craft (tactics) | Carry TWO of three, each about a different subject: the RADIO is everything the rivals are doing, the POWER METER is everything you are doing, FEED CRAFT is everything your resources are doing. Every piece of rival information on the HUD is tiered behind the radio (I: attacks and the chase, II: the leader gap, how far clear you are, and the rivals on the profile strip, III: the rail of riders off the top of the screen with exact metres). **There is more than one surface that draws rivals** — the strip was missed in build 15 and shipped ungated while the rail was correctly hidden, so `career.py` counts each surface separately. Carry no radio and you race what you can see. The power meter is the only tactic that does anything in a time trial | `TACTICS`, `you.stats.radio` in `drawHud` | `career.py` (radio gating, carry-two, TT power) |
| Gearing (PROTOTYPE, off unless `CFG.gearsOn`, and TIME TRIALS ONLY) | **Four** ratios 30% apart, calibrated to the measured INTERQUARTILE speed range 6-14 m/s, not the p5-p95 5-16 (p5 is a standing start, p95 a descent, and neither is ridden to a cadence); above and below that you have run out of gear, as in life. **The gear MOVES the rhythm target** rather than adding a second cadence bar to disagree with the first: a bigger gear turns slower at the same road speed so it pulls the target down toward grinding, a smaller one pushes it up until you cannot tap fast enough. So there is no separate economy penalty and no spin-out cap - the wrong gear moves the target away from your taps, `hold` falls, and `hold` is already charged in both speed and legs. **The target is floored at `strokeTempo`** or the rule spirals to a standstill (measured: a 1799s ride against a normal 108s). It reads a LAGGED speed (`gearLag`, ~1s), the recommendation is seeded with the gear you are IN and needs `gearHyst` to move, and the band widens (`gearBand`) because a moving target scored against a fixed target's window would charge you for shifting. **The band does NOT narrow up the ladder** (`gearRamp` 1.9, Division 8's value): the shipped ramp shrinks the window 2.19 -> 0.86 across the divisions and gearing moves the target 30% a shift, which stacked two difficulty sources on one axis. Division 1 is still harder, from the parcours. An ungeared TT keeps its ramp. The trade is that chasing the ideal gear is worth +3.3s mean instead of +8.7s, because the tight window was where the value came from. **`gearHyst` has a hard ceiling of 0.785**: one gear off misses by 1.02 or 0.785, so a bigger dead zone means a one-gear error can never light a chevron. Was six gears with none of the above and asked for **40-56 shifts a ride**; now **4.4 / 7.3 / 8.3 shift DECISIONS** at div 8 / 4 / 1, and worth MORE (+8.7s mean over one gear, up from +3.8s). A shift at full effort drops power ~15% for 0.34s and costs nothing while soft-pedalling, so you shift before the drag. **The road version was built, ridden and cut**: no fun, only difficulty | `CFG.gearsOn`, `you.gear`, `you.cadTgt`, `you.cadSpeed`, `you.gearIdeal`, `shiftBite` | `node tools/gearing.js` - **ten seeds, because six flapped**: a Division 1 median reported gate 2 as a hard FAIL (-4.4s) that read +5.7s at ten, and swung +13.9s to -5.7s across neighbouring sweep cells. Div 1 crashes most, so its median stands on the fewest clean rides. Counts DECISIONS not clicks (a 4-gear dump is one decision, three clicks) on CRASH-FREE rides only (the harness never steers, and a restart from a dead stop was 25 of one ride's 27 shifts), with a rider whose hand LAGS the target (tapping it exactly pins `hold` at 1.0 and makes the band unmeasurable) |
| The power meter's reading | It reads SUSTAINABILITY, not just effort: seconds until the legs are gone at exactly this rate, plus a projection slice on the LEGS gauge for the next 10s. Derived from `r.dE`, the per-second energy rate the sim RECORDS as it applies it — never recomputed in the view, because "computed in one function, displayed from another" is how the abandonment line shipped broken. The number moves enormously and none of it was visible before: at 2.4 strokes/s on 70 legs it spans 37s on a wheel on the flat to 10s in the wind on a 9% ramp on a rouleur body. Level I is the live gauge, II adds the reading and the projection, III adds EASE UP. Deliberately NOT speed: a tactic that made you faster would dwarf every measured number in the game and make information something you buy performance with | `r.dE` in `stepRider`, `PM_LOOK`/`PM_ALLDAY`/`PM_WARN`/`PM_REDLINE` in `drawHud` | `node tools/outlook.js` + `career.py` (reading, projection, level gating) |
| Feed craft's levels | Spelled out per level, NOT ramped, because `reach` and `feedSmooth` are coupled in the sim: extra reach lets you grab past 0.95 and `feedSmooth < 2` stumbles you for it, so a flat ramp made level I worse than carrying nothing. Level I carries `feedSmooth 2` outright. Whole tactic worth under half a place | `TACTICS` `levels`, `st.carbMix` / `st.feedSmooth` in `stepRider` | dominance + the note in DECISIONS.md |
| Cobbled sectors | A route can be a SECTOR rather than a climb: pave stamped into the surfaces list instead of the terrain, on FLAT days, one per race. Cobbles cut drafting to 0.62 as well as costing drag, grip and punctures, so a sector is where a flat race comes apart. Rated in stars, never in gradients | `isSector`, `c.sector`, `SURFACES.cobbles` | `career.py` (pack contents, sector wording) |
| Named roads | Every mountain day of every tour climbs a REAL named col, and every stage is titled from a town to a town. Five free roads (Vosges, Jura, Massif Central — ranges no pack claims, so free never cannibalises paid) plus whatever packs you own; paid roads are placed FIRST and take the decisive stages. Stage titles are derived from the seed, never drawn from the course PRNG, and live in the view, so generation is untouched | `ROUTES`, `assignRoute`, `stageTitle` | `career.py` (free roads, pack contents, titles) |
| The economy, on screen | Every locked or priced control SAYS so in visible text and answers when tapped: nothing is `disabled` and silent, nothing relies on colour alone, buying takes two taps so one cannot spend by accident, and the balance sits next to the prices. `title` tooltips are never the explanation, because a touch screen does not show them | `renderPhysique`, `renderTraining` | `career.py` (body UI states) |
| The economy | Racing UNLOCKS, prize money BUYS, and money can never skip an unlock, so a free rider's ceiling is identical and only adaptability and grind differ. Every layer keeps a free neutral, so a rider who owns nothing is still legal. Applies to specialist bike parts, physique and training | `partOwned`, `physOwned`, `trainOwned`, `ridableBuild` | `career.py` (24 checks) |

---

## How to add a mechanics test

Copy any existing `tools/tests/*.test.js`: they are self-contained scripts that
`require('../sim.js')`, build a scenario, and `process.exit(1)` on failure. Hard-won
rules encoded in the existing tests:

- **Flatten the whole course** for scenario tests (grades, elev, bend, swAmp, rounds,
  narrows, hazards, surfaces, primes, items, feeds, litters). A live bend plus a
  hold-your-line policy parks riders in the verge and invalidates everything.
- **Break riders need `plan: { k: 'raid', at: 0.99 }`** or they launch real attacks
  mid-test and pollute the scenario.
- **Replicate the drill's hold() exactly** (copy from the `train` drill in index.html)
  for drill-shaped tests; without it, cooperative mates drift 40+ back and the break
  dissolves.
- **Pin the decision layer when probing physics** (set `eff` directly each frame), and
  pin geometry when probing aerodynamics (set `x` after each step).
- **Drain `race.events` every step** or cues pile up and timestamps lie.
- A scripted player is crude: it cannot come through in-line (the contact rule blocks
  it, as taught) — steer alongside; and its "pull" can gap the drill mates in ways a
  human's never would. Judge steady-state laps, not the opening.
