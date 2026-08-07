# Slipstream — decisions, and things already tried

Read this before proposing a design change. Much of what looks like an obvious improvement
has been built, measured, and reverted.

## Things that were BUILT and CUT — do not rebuild without asking twice

- **Verge speed streaks** on descents. Read as a rendering fault.
- **Speed vignette** darkening the screen edges. Decoration on a game whose look is flat
  and clean.
- **Mini maps**, both an in-race strip and a briefing overview. Kevin's own idea, built to
  spec, and cut on sight.

**The pattern, confirmed three times:** additive screen furniture gets built, looks wrong,
and gets cut. What has survived is changing what is ALREADY there — the camera lead instead
of motion lines, the rhythm bar REPLACING the gauges rather than joining them, road width
instead of new markers. Treat "add a HUD overlay" as a losing move.

- **Reducing draft on descents** to make attacking over the summit pay. It worked
  directionally but never flipped the ranking, and cost parts balance at every value
  tested. Reverted in full. If retried, the descent-draft lever is the wrong one — the real
  obstacle is that a climb attack is simply the strongest move in the sim.

## Decisions that were reversed, deliberately

- **Handling used to scale UP with speed.** Now inverted: slower means more steering
  authority. This is why braking is the answer to a corner — it cuts the drift AND raises
  your ability to answer it.
- **Abandoning a tour used to be free.** Now it costs the tour and holds your draw and
  build, so quitting can never be used to shop for a friendlier parcours.
- **Feed zones used to avoid sitting before a climb or sprint.** Now food is scattered
  along the road, because feeding was gating when you could attack.

## Rejected, with reasons

- **Division → Category.** More authentic, but touches every screen, the save data and the
  glossary, and "division" is unambiguous to a non-cyclist in a way "cat 3" is not.
- **More than 8 riders** in the three-week tour. Field size is baked into every balance
  measurement. Built rider ABANDONMENT instead, so the field shrinks to 75% — which costs
  nothing in balance and gives the lanterne rouge weight.
- **Three quick taps to hop a pothole.** Hopping a hole is the same action as hopping a
  median, which already has a button, and three taps collides with both core inputs
  (tapping IS pedalling, holding a side IS steering). The existing hop button is used.
- **A button to auto-position you in a rotation.** It would remove the only skill the
  mechanic teaches. The problem was that the rotation was invisible, not that it was hard.
- **"Rejoin as if the crash never happened"** for the second chance, and **three
  chances a race**. Both cut (2026-08). Erasing the crash makes crashing out a loading
  screen and recklessness free; three chances is functionally always. Shipped shape:
  ONCE per race, and the revival is a diegetic chase — wheel-change taps set how far
  behind the bunch you restart, the convoy's bumper drafts are the ladder back
  (slaloming bumper to bumper is mandatory; the road's crown drafts nothing), and the
  broom wagon ends it exactly as if you had never tried. A bad wheel change costs
  legs, not a stat: you must ride harder to make it, and you arrive cooked. Declining
  the offer spends it. Chosen over abstract mini games (rollers, ghost chase,
  cyclocross remount) because chasing back through the cars is what actually happens
  after a real crash.
- **A convoy you can sit in.** The chase-back cars were first spaced evenly across
  whatever the gap was, which put them nose to tail: one continuous draft, so the chase
  was a straight line at whatever the shelter gave you. Cars are now spaced FURTHER
  apart than a car's draft reaches, so every rung is earned through clean air — and
  they are solid, so you ride around them or you stop. Measured skill gradient: using
  the cars AND pacing wins every seed; flat out with no pacing is broomed 8 of 9;
  ignoring the cars is broomed 9 of 9.
- **Letting the wheel change feed legs as well as distance.** A fumble then punished
  both and the two multiplied into a near-certain DNF (broomed 2 of 3 with perfect
  play). The change moves ONE axis — how far back you restart — and the roadside stop
  gives every rider the same breather. Related: a rider revived on cracked legs is
  capped below bunch pace, so the whole convoy sails away and no chase exists at any
  spacing; the leg floor is load-bearing, not generosity.
## The three layers: body, bike, tactics

Decided 2026-08 after Kevin: "it feels like I only have one option per archetype", and
"bike parts seem to be what changes the radar chart the most". Both were measurable. A
single part swap moves the radar up to 0.48 on one axis, more than a WHOLE CAREER of body
growth moves any axis, and on aero and handling the body contributes exactly nothing, so
those two axes are pure bike. Also found: wheels, position and tires all trade aero
against handling, so they are one decision made three times, which is what "one option per
archetype" actually meant.

- **Body TRAINING is pure positive on a points budget; body PHYSIQUE is pro/con.**
  Training genuinely makes you better at something without making you worse elsewhere, so
  a trade-off there is a lie; the budget does the balancing instead. A physique cannot be
  light and powerful at once, so weight IS a trade-off. Making every single choice a
  pro/con means you can never simply feel stronger, which is the point of a career.
- **Bike parts stay trade-offs**, because a deep wheel genuinely is faster and genuinely
  is worse in a crosswind. Physics, not game design.
- **New bike parts must open a NEW axis in their slot.** A fourth point on a slot's
  existing line is a finer version of a choice you were never making.
- **Money buys breadth, never power. Unlocks and budget are earned by playing and can
  never be bought.** Resolves the tension with "the ladder is never pay-to-skip": the
  ceiling is identical for a free player, only adaptability and grind differ, and the
  daily hands everyone a full career and full tactics regardless.
- **Every layer keeps a free neutral option** (Balanced weight, All-round muscle, the
  neutral part in each slot), so a rider who has bought nothing always has a complete,
  legal, competitive setup.
- **`engine` moves from the bike to the body.** Diesel legs are physiology, not equipment;
  it only sat in the bike list because that is where the build system happened to live.
- **Three tactics, three subjects, carry two.** The pool is the radio (everything THEY are
  doing), the power meter (everything YOU are doing) and Feed craft (everything your
  RESOURCES are doing), and leaving one out has to hurt differently each time. A fourth
  information tactic would have been the wrong addition for the same reason wheels, position
  and tires all buying aero was: two ways to read the race is one decision made twice.
  Widening the pool alone would NOT have saved the power meter — you would take the radio
  plus whatever else and drop it anyway — so it also got the time trial (below). Both halves
  or neither.
- **Feed craft is code that already existed and no rider could reach.** `carbMix` (a bottle
  feeding you as well as watering you) and `feedSmooth` (no stumble taking one wide) are
  implemented in `stepRider`, sit in `BASE_STATS` and `FLAG_KEYS`, and were reachable only
  through the dead `UPGRADES` catalog that nothing calls. Its levels are spelled out
  explicitly rather than ramped per level, because the two stats are COUPLED in the sim:
  extra `reach` lets you grab beyond 0.95 and `feedSmooth < 2` stumbles you for doing it, so
  a flat ramp measured level I as **worse than carrying nothing** (6.50 against 4.03 places
  on the mountain template). Level I now carries `feedSmooth 2` outright. Whole tactic is
  worth under half a place, so it is a choice and not a must-pick.
- **The power meter draws in a time trial.** It was suppressed there, which was never a
  decision: it fell out of "a time trial shows ONE thing" when the rhythm bar replaced the
  gauges, and swept the power meter out with the three resource bars. A real time triallist
  rides to numbers and nothing else. This is also what stops the power meter being a slot
  nobody spends, because on a TT it is the only tactic that does anything.
- **The profile strip's rival ticks are Radio II, and missing them was a real failure
  (build 17).** Build 15 gated the pip rail behind Radio III, shipped a browser test
  proving the rail drew nothing without a radio, and left `drawProfile` painting every
  rider in the field across the whole stage for free, four hundred lines away. The thing
  left open was strictly MORE informative than the thing hidden: the rail reaches about a
  screen, the strip shows the break, the bunch and the stragglers at a glance. Kevin found
  it in ten minutes of play. The lesson is the one already in CLAUDE.md and I broke it
  anyway: checking the half you just wrote is not the same as asking what ELSE draws
  rivals. `career.py` now counts every rival-drawing surface separately, not just the rail.
  Level II because the strip and the leader gap answer the same question (the SHAPE of the
  race); level III still buys the exact metres.
- **Your deliberate soft-pedal drop-back has its OWN constant, `CFG.easeCut` (0.45), and it
  is not `swingCut`.** A rival's `swingOff` is an automatic 2.2s drift after their turn; a
  human holding both pads is asking to go backwards now. Keeping them separate is what
  makes the value safe to raise: `swingCut` is also read by the rival swing and by its cap
  against the front, so lifting the shared constant would re-time every rotation and put
  the rejoin at risk. Measured sweep of the player value alone: 0.09 gave a 5.9s median
  (3.6-8.9), 0.22 gave 4.5s, **0.45 gives 3.2s (3.1-3.3)** which is the documented promise
  with the tightest spread, and 0.60 got worse and noisier (3.5s, up to 10.2). At 0.45 all
  38 mechanics tests pass and the second chance is untouched (7/7 and 6/7), because that
  code path needs a `breakFront` and a convoy chase never has one. It is also
  self-terminating: the cap only applies while `youWasBack` is false, so it switches off
  the instant you are behind the last wheel and you cannot overshoot off the back.
- **Every piece of RIVAL information on the HUD belongs to the race radio.** Where the
  leader is, how far clear of the bunch you are, whether it is chasing, and the rail of
  riders off the top of the screen were all free and permanently on screen for everyone,
  which is a modern earpiece handed to a rider who never fitted one. It also made the
  radio nearly decorative, because it repeated numbers you already had. Now it is tiered:
  **I** hears the race (attacks, chase), **II** adds the numbers (leader gap, how far
  clear), **III** opens the rider rail. Carry nothing and you race what you can see, which
  is how racing worked for a century. YOUR position, points, KOM, speed and gauges are
  never gated: they are yours and you can feel them. Follow-on idea, not built: the
  chalkboard moto (the ardoisier) as the free, diegetic way to learn a gap without a radio,
  using the moto that already visits rather than new screen furniture.
- **Race craft is fitted, not drip-fed.** Race radio and power meter used to arrive
  automatically on career wins, so you simply had whatever your record had handed you.
  Fitting now decides whether you carry it, the career decides how good it is (floored at
  level 1 so fitting always buys something), and the limit is deliberately ONE while the
  pool is two, because "fit 2 of 2" is not a decision.
- **Rejected: the old `UPGRADES` tier ladder** (3 strictly-better tiers per item, bought in
  order). Strictly-better ladders make money equal strength, turn the game into a grind,
  and put every purchase outside what the dominance harness can certify.

### The economy, as shipped (2026-08, phase 4)

**Racing UNLOCKS, prize money BUYS, and money can never skip an unlock.** Every purchasable
thing has two gates and they are not interchangeable: a division or a dimension level opens
it, and only then will money take it. Kevin's rule, in his words: "You have to play and
earn/unlock everything but then you use prize money or real money to buy it after you have
unlocked it."

| layer | unlocked by | price | free neutral |
|---|---|---|---|
| Bike part | the part's `unlockDiv` | flat 1,000 (`UNLOCK_COST`) | the neutral part in each slot |
| Physique | a dimension level (`PHYS_REQ`) | 800 to 2,400 by how far it swings | Balanced weight, All-round muscle |
| Training | a dimension level (`trainReq`) | 700 per point of cost | none needed; an empty budget is legal |

Consequences worth keeping straight:

- **A broke rider is never illegal.** `ridableBuild()` sanitises the build at lock-in AND at
  save load, so an unowned part falls back to its slot's neutral rather than racing. Same
  for physique. `career.py` case 7 asserts it: strip the wallet and the bike is still
  complete.
- **The points budget is EARNED only.** Money buys a training block; it never buys the
  points to ride it. Owning more than you can fit is the intended end state, because the
  choice of what to carry is the mechanic.
- **The daily is unaffected.** It runs `raceStats(build, null, true)` with a full career and
  full tactics for everyone, so the shared leaderboard never reads a wallet.
- **The ceiling is identical for a free player.** Only breadth (how many answers you own for
  a given parcours) and grind differ. This is what "the ladder is never pay-to-skip" has to
  mean once money buys anything at all.
- **Prices are read off the route-pack ladder**, which is the only price scale the game had:
  a route pack is 3,000 and a three-week tour pays about 6,000, so a part at 1,000 is a
  couple of good stages and a top physique at 2,400 is a campaign.

- **Four bike parts, written and cut in the same session** (2026-08, phase 3). An AERO
  FRAME and a SEMI-DEEP wheel: aero is the most crowded axis in the game, traded by
  wheels, position AND tires, so a fourth way to buy it is not a new decision, and the
  semi-deep sat literally between two existing options on that same line. An ARMOURED
  TIRE and a tough TUBULAR wheel: their whole virtue was puncture resistance, and the
  stage templates carry almost no rough road (measured: zero hazards on four of five
  templates), so the harness read them dead and they would have been dead in play. The
  rule that came out of it: **a new part must open an axis the BIKE lacks, not merely one
  its own slot lacks.** The tubular survived by being rewritten as a descender's wheel,
  which every mountain template exercises.
- **"Never strictly best" as the dead-part test.** It does not scale past a handful of
  options: with three parts over five templates each had ~1.7 templates to claim, at five
  parts it is 1.0, so the pigeonhole alone condemns parts however good they are, and the
  casualty list churned between seed counts. Dominance now asks whether a part lands
  within 0.40 of a place of the best somewhere, which is the real question ("would you
  ever sensibly pick this?"). Dominant is unchanged: strictly best everywhere.
- **A presence-percentage rule for the musette** ("in the lane 90% of the line").
  A hidden meter: failing a grab at 85% reads as a random denial. Same intent, readable
  rule instead: the hand-up sits at 0.60 of the zone, and the pass is LATCHED — be in
  the soigneur's lane as you cross the start of the line and stay on it, or no bag.
- **Bib 0, and duplicate bibs.** Road racing has no bib 0 and no two riders share a
  number, so the picker (1-99, two segmented digit rows in Settings) refuses 0 and the
  seven numbers the rivals wear, by name ("42 is PICO's number"). An earlier 1-9 cut
  argued one digit is all that fits a rider dot; wrong on its own evidence, since
  rivals already wear 11-78 legibly at the same scale.
- **Making 4-6 rider breaks rotate** (decided 2026-08, option "leave it"). The group
  detector calls the largest group "the peloton", and in an 8-rider field a 4+ break IS
  the largest group, so through-and-off never engages for it. This deviates from real
  racing — a 5-rider move up the road is still the break — but the fix means redefining
  the peloton, which chase, the driver and mass shelter all hang off. A corner case at
  this field size; documented as a known gap in MECHANICS.md. Revisit (as "peloton =
  group with most GC riders" or "rearmost large group") if fields ever grow beyond 8.

## The ladder: the day gets harder, the riders do not get faster (RESOLVED, build 16)

The escalator described in the next section is fixed. `tierProfile().strength` is gone, and
`len` (0.18 to 0.40) and `hilly` (0.14 to 0.32) went up to replace what it was doing.

**Deleting the speed ramp alone does not work, and that is the whole finding.** It was
carrying two jobs: an unearnable handicap (bad) and mountain selectivity (good), because
what shatters a field on a climb is ABSOLUTE PACE. Take it out and the queen-stage margin
for a climbing rider over a sprinting one goes from +20 places to **-11** — sprinters
winning mountain stages. Longer, hillier days put the selection back a different way: you
arrive at the decisive climb with less in the legs, which is why the Alpe at the end of
200 km is a different mountain from the Alpe after 60.

| gate | before | after |
|---|---|---|
| ladder drift, Division 8 to 1 | +2.16 | **+1.11** |
| worst rung's payoff for a career of growth | 0.88 | **1.46 places** |
| queen: climber over sprinter, summed | +20 | **+49** |
| second chance, clean / fumbled wheel change | 5 of 7, 5 of 7 | **7 of 7, 6 of 7** |

**And it had to be the DAY, not the CLIMB.** Kevin's question ("how does harder terrain and
playing real routes work") is what forced this. A named route stamps its REAL gradient and
length into the road and must keep them, or Alpe d'Huez stops reading HC off its own
figures. Steepen climbs by division and **a $2.99 route pack becomes the way to buy an
easier Division 1**, which breaks "the ladder is never pay-to-skip". Stage length and the
preamble scale on route stages too, so this lever cannot be bought around.

Two knock-ons, both measured and worth knowing:

- **Drop-back is slower.** Median steady-state GOOD TURN to at-the-back went 3.3s to 5.9s,
  because a train that is no longer given free speed takes longer to ride away from you.
  Still inside the promise, but it moves toward the thing Kevin complained about
  originally. ~~`CFG.swingCut` is the knob if it feels sluggish in the hand.~~ **That advice
  was wrong twice over and is superseded by `CFG.easeCut`** (see "Your deliberate soft-pedal
  drop-back has its OWN constant"). Raising `swingCut` applies SYMMETRICALLY to the AI, so
  the wheel you are falling behind recedes as fast as you do and the metric goes BACKWARDS
  (measured: 4.5s at 0.09 rising to 6.2s at 0.28). And changing it is not guarded by the
  suite you would naturally run: see "The mechanics suite gives a false green on the swing
  constants" below.
- **Relaxed reach had to be rebalanced.** Its virtue was almost entirely `fatigueResist`,
  which is next-day value, and dominance rides ONE stage so it could never see it. Alive by
  a whisker on the old terrain, dead on both seed sets once days lengthened. It now also
  buys same-day handling and recovery, which is what a relaxed reach actually gives a rider.

**The dead-part gate is not stable at six seeds, on either sim.** The previously shipped
build measures 0 dead on one seed set and 1 on another; this one measures 2 and 1, with no
part dead on both. Phase 3's "0/0 confirmed at six seeds" was seed-specific. Treat a
casualty as real only if it repeats across seed SETS, as `relaxed` did. `DOM_SIM` now lets
dominance run against an alternate extracted sim so before/after is attributable.

## The ladder's downward escalator (the diagnosis, kept for the reasoning)

Kevin, 2026-08: "It shouldn't feel like when you improve that nothing changed compared to
your rivals." He proposed making the rivals weaker in the easy divisions and equal at the
top. Measured with a new harness, `tools/ladder.js`, which grids DIVISION against PLAYER
DEVELOPMENT and reads the spread down each column:

- **Growing your body DOES pay at every rung** (weakest is Division 7 at 0.88 places for a
  whole career of growth), so "nothing changed" is not literally what is happening.
- **The real fault is worse and it is the other way round.** A rider who arrives at each
  division developed exactly for it finishes **4.11 at Division 8 sliding to 6.27 at
  Division 1** — second to last in an eight-rider field, having done everything right.
  Not a treadmill, a downward escalator.
- **The cause is `tierProfile().strength`**, a raw speed bonus of up to 3.5% added to every
  rival and to nobody else. The player's `strength` is pinned at 1.0 with no way to earn
  any. Note that the comment two lines above it in the source says difficulty comes "not
  from rivals being faster", which the code has been contradicting all along.

Three fixes were built and measured. Every one broke something else, so **none shipped**:

| fix | ladder drift D8 to D1 | mountains select climbers | second chance, fumbled change |
|---|---|---|---|
| today | +2.16 | +20 places | 5 of 7 seeds |
| delete the bonus | **+0.32** | **-11 (sprinters win mountains)** | 5 of 7 |
| share it with the player | +2.16 | not isolated | **2 of 7** |
| curve the rival body (1.6) | +0.32 | **+73, no division inverted** | **1 of 7** |

What that table says: the speed ramp is **load-bearing for mountain selectivity**, because
what shatters a field on a climb is absolute pace. And anything that weakens the mid-ladder
field re-tunes the second chance, whose whole balance is calibrated against the bunch's
pace — a fumbled wheel change becoming a near-certain DNF is the exact outcome this file
already records as rejected once. Gentler curve exponents do not escape it (1.25 measured 1
of 7, 1.15 measured 3 of 7).

**The lever that worked was making the DAY harder, not the CLIMB** (see the section above,
which supersedes this one). Note that the first phrasing of that recommendation was wrong:
"steeper and longer climbs" would have made route packs pay-to-win, and only the length and
preamble of the day are safe to scale.

## Gearing found its home: time trials, where the gear moves the rhythm target (build 24)

Kevin rode the road version and his verdict was that it added no fun, only difficulty. The
harness had already said the same in numbers (see the section below). So the road path is
gone and gearing lives on the race of truth, which is a better fit for reasons that measure:

- **TT speed spans 3.5x** from the 5th to the 95th percentile at Division 4, as wide as a
  road stage, so the right gear genuinely moves through the ride. This was the objection that
  could have killed it — a short flat TT would mean one shift at the start and a setup screen
  rather than a mechanic — and it did not survive contact with the measurement.
- Your thumbs are free. No positioning, no attack, no feed to take.
- A TT is already about holding a rhythm, so the gear has something to act on.

**The gear moves the target. It does not get a bar of its own.** Kevin asked for "a bar next
to rhythm for the ideal gear", and a literal second bar would have put two definitions of
cadence on one screen to contradict each other — the exact two-systems problem he had asked
to avoid one message earlier. Instead the target the rhythm bar already draws stops being a
fixed `ttCadence` and becomes `speed / (ratio * cadScale)`. A bigger gear turns slower at the
same road speed, so it pulls the target down toward grinding; a smaller one pushes it up until
you cannot tap fast enough. The right gear is the one that puts the target back where a rider
sustains it, so the ideal gear is a function of your speed and it drifts as the speed does.
What sits beside the bar is a GEAR LADDER, an index into the ratios with the one to aim
for ringed, which cannot contradict the rhythm bar because it is not measuring cadence.

**Superseded in part by build 32**, which cut six ratios to four, recalibrated them off the
interquartile speed range rather than p5-p95, and added the lag and hysteresis that the six-speed
lacked. The 3.5x span quoted just above is the p5-p95 figure and is the wrong window: p5 is a
standing start and p95 is a descent. The rest of this section still holds.

**That also deleted two mechanisms.** The road version had a separate `gearCost` economy
penalty and an explicit spin-out power cap. Both are gone: the wrong gear moves the target
away from your taps, `hold` falls, and `hold` is already charged in speed here and in legs in
`stepRider`. Two ways of saying the same thing is one too many.

**One load-bearing floor, found by measurement.** The target is `max(strokeTempo, ...)`.
Without it the rule spirals: a low speed makes a low target, tapping at a low target makes
less power (the `pedal` term is proportional to rate up to `strokeTempo`), less power makes a
lower speed, and the target chases it to a standstill. A Division 1 ride measured **1799s
against a normal 108s**. A rider getting going pedals harder than their efficient cadence, so
the target never instructs below tempo — and at crawling speed every gear reads alike, which
is true.

**What it is worth, confirmed on two seed sets.** Chasing the ideal gear against sitting in
one, median TT time: +0.7s / +4.9s / +5.8s at Divisions 8 / 4 / 1 on the first set, and
+0.3s / +1.3s / +14.1s on seeds the tuning never saw. Both sets agree in sign at every
division and both show the gain GROWING with division, which is what Kevin wanted from it.
Against mashing the chevrons it is 8 to 28 seconds. In a ~140s time trial, five seconds is a
result. That is a far cleaner reading than the road version ever produced, and the reason is
structural: a TT is scored on a continuous clock with no bunch, where the road was scored on a
finishing rank with twenty riders interacting.

**Two harness faults worth keeping.** A mean over six seeds reported a Division 1 ride at
1796s because one of them ended in the broom wagon carrying the +9999 sentinel that DEV-LOOP
already flags as expected; it read exactly like a catastrophic bug in the mechanic. Medians
with DNFs counted separately. And the harness never steers or brakes (`tx: you.x`), which
DEV-LOOP warns makes corners look unmakeable: the DNFs at Division 1 are the FASTER policy
arriving at a bend quicker and crashing out on the same metre where the slower one crashes,
takes a team car and rides on. Harness, not mechanic.

**The golden does not regenerate.** `CFG.gearsOn` is false in a shipped build and the golden
never turns it on, so TT times only move with the toggle. An earlier note in this
conversation said the golden would have to be regenerated; that was wrong.

## The game could not save in a browser, and the test shim is what hid it (build 34)

Found while investigating a stuck GitHub Pages deploy, not by playing. `window.storage` was
**read in four places in `index.html` and defined in none.** Some hosts provide it, and
`tools/browser/*.py` injects it before the page script runs. An ordinary browser has no such
object, and every call sits inside a `try/catch` that swallows the `TypeError`.

Measured in Chromium against build 33, with no shim:

```
window.storage present: undefined
localStorage usable   : True
visible screens       : ['menu']
page errors           : none
```

So the game booted, played, reported nothing wrong, and **discarded every save**. `Store.load()`
returned null on the next visit and the career started from zero. On GitHub Pages that had been
true for dozens of builds. The comment above `Store` claimed it "degrades to session only"; it
did not even do that.

**The shim was the bug's accomplice.** Every browser case injected the exact object whose absence
was the defect, so a 95-check suite stayed green across the whole period. That is a sharper
version of the failure this file keeps recording: both halves existed, were correctly written and
correctly wired to each other, and the layer underneath them was never built outside the harness.

The fix defines `window.storage` **only if the host has not**, so an injected shim or a real host
store always wins. It is backed by `localStorage`, probed with an actual write because
`localStorage` throws rather than returning null when it is blocked (Safari private browsing, a
third-party iframe, cookies off), and falls back to an in-memory `Map` when that probe fails — so
the save now survives the session even in the worst case, which is what the old comment promised.

**The regression guard is a case that runs with NO shim**, because nothing else could have caught
this. It asserts the store exists, that `get` returns a `{value}` record and null for a missing
key (a bare string would make every `JSON.parse(r.value)` yield undefined), and then the part that
actually matters: pick a kit colour, **reload the page, and check it is still selected**. Verified
to be meaningful by running it against both versions:

| | `__storeKind` | localStorage written | kit after reload |
|---|---|---|---|
| before (build 33) | `None` | no | **LOST** |
| after | `localStorage` | yes | survives |

Neither version logs a page error, which is the whole reason this needed a test rather than a
glance.

**The diagnostics page now names the store** as its first row, and flags anything that is not
`localStorage`. A diagnostics page that cannot show you the bug is decoration — the same lesson
the tactic-levels row learned in build 31.

## Gearing asked for a shift every three seconds, and three separate things caused it (build 32)

Kevin rode build 24's six-speed and asked for four changes before trying auto-shift. All four
are in, and the fault they were aimed at was real and worse than it looked: **40 shifts a ride
at Division 8, 50 at 4, 56 at 1**, across a 110-140s time trial. That is one every two or
three seconds. Gearing had stopped being a decision and become a second pedalling task laid
over the first. I had those figures at build 24 and reported them as a neutral statistic
rather than recognising a broken mechanic, which is the failure worth recording here.

Three independent causes, none of which is "the numbers wanted tuning":

1. **Six rungs 26% apart**, so a breath of speed crossed a boundary. Now four rungs 30% apart.
2. **`gearIdeal` was recomputed from the instantaneous speed**, so it flickered many times a
   second. Now both the target and the recommendation read a LAGGED speed (`gearLag`, about a
   one-second time constant), which is roughly how long it takes a rider to notice the road
   has tilted.
3. **No hysteresis**, so once it moved it flickered straight back. The recommendation is now
   seeded with the gear you are IN and another has to beat it by `gearHyst` to light a chevron.

Also: the band widens when gears are on (`gearBand`). A moving target scored against a fixed
target's window would charge you for the act of shifting, since a shift steps the target 30%
at once.

**Recalibrated to the bulk of a ride, not its tails.** The six-speed span came from the p5-p95
speeds, 5 to 16 m/s. That was the wrong window: p5 is a standing start and p95 is a descent,
and neither is ridden to a cadence. The measured interquartile range is about 6 to 14 m/s, so
the four gears cover that and the extremes pin at gear 1 or 4 — which is the truth of it. On a
fast descent you have run out of gear, exactly as in life.

**Result: 4.4 / 7.3 / 8.3 shift decisions a ride** at Divisions 8 / 4 / 1, and the mechanic is
worth MORE than before, not less: chasing the ideal gear against sitting in one went from
+3.8s to **+8.7s** mean. Auto-shift is not needed and stays unbuilt.

### The window stopped narrowing up the ladder (build 33)

Kevin rode build 32 and it was **still really hard**, and asked for one difficulty at every
division, using Division 8's. He is right and the diagnosis is that two difficulty sources
were stacked on the same axis:

- the shipped rhythm ramp shrinks the tolerance window from 2.19 at Division 8 to **0.86** at
  Division 1, and
- gearing then moves the target 30% at every shift, inside that shrinking window.

So the geared band no longer ramps: `gearRamp` is 1.9, which is exactly what
`1.9 - 1.15 * D.t` evaluates to at Division 8. Not a new number, the ramp frozen at its easiest
rung. **The ramp still applies to an ungeared time trial** — it is a fine lever on its own and
Kevin has never objected to it there — so this is gated on `race.gears` and the golden does not
move.

**The trade, stated plainly.** Chasing the ideal gear is now worth **+3.3s mean** against
sitting in one gear, down from +8.7s. That is not a regression in the mechanic; it is where the
value was coming from. A tight window is what made a wrong gear expensive, so easing the window
necessarily cheapens it. Measured across window widths, all with the flat ramp:

| geared window | gain, div 8 / 4 / 1 | mean | avg `hold` |
|---|---|---|---|
| 3.17 (**shipped**, div 8's build-32 window) | +2.7 / +1.4 / +5.7 | +3.3s | 0.953 |
| 2.62 | +3.5 / +0.5 / +5.1 | +3.1s | 0.945 |
| 2.18 (div 8's *ungeared* window) | +4.5 / +4.8 / +28.0 | +12.4s | 0.934 |
| 1.86 | +6.1 / +5.2 / +20.3 | +10.5s | 0.922 |

2.18 is tempting and was rejected: it is Division 8's window *without* the gearing widener, so
it would make Division 8 **harder than the build Kevin just rode and called too hard**. He asked
for easier and uniform; 3.17 is both. If +3.3s ever reads as too weak in the hand, 2.18 is the
next rung and this table is why.

**The gate flapped at six seeds and reported a false FAIL.** The flattened band first measured
gate 2 as broken — Division 1 at **-4.4s**, chasing the ideal gear LOSING to sitting in one,
which reads exactly like a dead mechanic. At ten seeds the same measurement is **+5.7s**.
Division 1 is where the harness crashes most (it never steers), so its median stands on the
fewest clean rides and is the least stable number in the file — and it is the number the gates
are read off. `SEEDS` is ten now. This is the same volatility that made a tuning sweep swing
from +13.9s to -5.7s across neighbouring cells; it has now cost time twice.

### Three measurement traps, all of which would have shipped a wrong number

- **The harness could not see the band at all.** Its rider tapped at `cadTgt` exactly, every
  frame, so `hold` was pinned at 1.0 in every run and the tolerance could have been set to any
  width with no measured difference. It was only ever measuring whether the target had gone
  above the tap ceiling. A real hand cannot jump 30% in a frame; it chases. The harness rider
  now lags, so a shift costs a real dip in `hold`.
- **Counting clicks scored the width of the ladder.** Dumping four gears at the foot of a climb
  is one decision and three clicks, and the click count can never fall below the gear span
  however clean the recommendation is. Traced at Division 1, the shifts arrive as pure
  sequential sweeps with no reversals at all — 4-3-2-1 slowing onto a ramp, 1-2-3-4 coming off
  it. So the gate counts DECISIONS, a run of clicks in one direction.
- **Most of the residual count was the harness crashing.** It never steers (`tx: you.x`), so it
  crashes into bends, takes a team car and sets off from a dead stop, and each restart costs a
  full climb back up the ladder. On one Division 4 ride that was 25 of the 27 shifts. The gate
  now scores crash-free rides and prints the stop count beside it.

**A tuning trap worth writing down, because a sweep will find it again.** Hysteresis of 1.25
looked best on shift count alone — 3/7/7 a ride — and is a broken mechanic. One gear off puts
the miss at 1.02 or 0.785 cadence, so a dead zone above 0.785 means a ONE-GEAR error can never
light a chevron: you are only ever told to shift once you are two gears out and you spend the
race chasing from behind. The ceiling is 0.785 and it is now written in the CFG comment rather
than left for the next sweep to rediscover. Shipped at 0.45.

**Also fixed: the gear number printed at `W / 2`**, which is the centre of the action button.
A rider carrying full team support got "GEAR 2" laid straight over "STICKY BOTTLE · TAKES A
PENALTY". The number now sits in both shifter pills, which is cheaper than the collision and
puts the gear under whichever thumb you are looking at. The chevrons themselves went from
about 53px to 84px on an ordinary phone with a glyph that scales off the pill: gearing only
exists in a time trial, and a time trial clears feeds, items and litter, so the action button
has almost nothing to show there.

## Both prototypes graduated to defaults (build 35)

Kevin, after riding them: "The drop back rewrite can be the default now" and "make the time
trial use the gears I like it." Both toggles are gone — a switch whose feature has shipped is
worse than no switch, because it implies a mode the build does not have.

**Gearing is on, still gated on the stage.** `CFG.gearsOn` is true and `createRace` keeps the
`course.spec.tt` gate, so a road day is byte-identical and only time trials move. The road
version stays cut.

**The drop-back budget only became defensible when it applied throughout.** Behind the toggle it
required `bf !== r`, so for the seconds before a team-mate actually came past — most of the early
swing — it switched itself off and the old fixed cut ran instead. That seam was the whole defect.
Traced on the worst case, the swinger's speed matched "the front's" to the decimal for six
straight seconds because it WAS the front, and that run took 28.7s.

| | median | worst |
|---|---|---|
| fixed pace cut (build 34 and earlier) | 3.17s | 4.83s |
| budget, gated on `bf !== r` | 3.90s | 28.68s |
| **budget applied throughout (shipped)** | **3.08s** | **5.38s** |
| the player, for reference | 3.30s | 8.90s |

**A rule that stops applying halfway through is two rules, and the seam is where the tail was.**
That generalises past this mechanic and is the reason the entry is here.

**`swingSecs` 4.0 and `swingFloor` 0.74 were chosen for realism, not for score.** Faster cells
exist and were rejected: 2.2s/0.66 measures a 2.01s median, and a rival who drops back quicker
than the player does at 3.30s is the opposite of the thing being modelled. A real drop-back takes
four to six seconds.

**Side effects worth recording**, both measured after the change:

- **Dominance improved, 4 dead parts to 1.** The rotation now completes nearly twice as many
  handovers in the same wall clock (49 against 27 in the harness), and that wider spread of race
  shapes gave more tires somewhere to be best.
- **The ladder's worst rung improved, 1.17 to 1.47**, so no column is flat. On-path drifts
  3.63 to 5.30, steeper than the 4.11 to 5.15 it replaced but still inside the contest band.

The golden was regenerated: the drop-back changes AI rotation in every race, so this is not a
time-trial-only regeneration. `tools/aiswing.js` now measures one rule and keeps the three-row
history in its header, because those numbers are the argument for the current shape.

## The distance-budget drop-back is worse, and the tail it was built for never existed (build 32)

Kevin asked for a debug toggle so he could ride the drop-back rewrite. It is built and it is
behind `CFG.swingBudget`, off by default. It is also **measurably worse than what ships**, and
the reason it was ever wanted was a third harness fault.

Build 21 recorded the rewrite as halving the worst case, 39.1s to 20.1s. **There was no 39s
case.** `tools/aiswing.js` started its clock whenever `race.breakFront` changed — including in
breaks that were NOT ROTATING, where that name just means "whoever is furthest up the road"
and it changes for reasons that have nothing to do with a handover. Instrumented, those long
runs had `race.rotating` false and `swingOff` 0 for their entire length: the rider was never
relieved and was never dropping back. Gate the trigger on `race.rotating` and the tail vanishes:

|  | median | range |
|---|---|---|
| fixed pace cut (ships) | 3.17s | 0.35-4.83s |
| distance budget | 3.90s | 0.73-28.68s |

The shipped rule is better than the player's own drop-back (3.30s median, 8.90s worst) and
inside the 4-6s this design claims. The budget is slower in the middle and introduces a 28s
tail of its own; the floor is why, since a 13 m gap asks for about 75% of the front's pace and
the 0.82 floor binds first.

**That is the SECOND drop-back figure this harness invented.** The first was 11.91s from timing
contiguous runs of `swingOff`, retracted in build 21 (see the section below). Both times the
number was written into docs and treated as a defect before the harness was checked. The
standing lesson: a drop-back is a rotation event, so a measurement window that outlives the
rotation is not a slow drop-back, it is not a drop-back.

The toggle stays, because feel is the one question a harness cannot answer and Kevin asked to
ride it. If it does not feel better in the hand, delete the branch rather than tune it — there
is no problem left for it to solve.

## Gearing on the road: built behind a toggle, and the numbers could not tell you whether it was good (build 23)

Kevin asked for gearing behind a debug toggle so he could try it without disturbing what
ships. It is built, it is mechanically correct, and **its competitive value is inside the
noise.** That is the finding, and it is not a reason to delete it — it is a reason to stop
measuring and start riding.

**The model, and the two versions that were wrong first.** Cadence is road speed divided by
the ratio, and you pick the ratio; effort is how hard you push. So the tap loop is untouched:
taps still mean effort. Grinding in a big gear on a ramp, spinning out in a small one on the
flat, and needing to shift up as a sprint winds on all fall straight out of that one line.
The first sketch had gear multiply POWER, which puts you in a *big* gear on a 9% wall,
backwards from real racing. The first calibration then set a 4x ratio range from a rider held
at one fixed effort in still air, a scenario no stage produces; driving full stages with the
sim's own AI put the real 1st-to-99th percentile speed at about 5 to 16 m/s, so the range is
3.2x and gear 4 at a fast bunch pace is the neutral case.

**The wrong gear has to cost more than the shifts that fix it, or ignoring the gears is
optimal.** At `gearCost` 0.75 that is exactly what happened: sitting in gear 4 all race beat
shifting to hold the band by 0.26 places. A mechanic whose best play is to ignore it is worse
than no mechanic.

**And then the tuning would not reproduce, which is the part worth remembering.** A 12-race
sweep of `(gearCost, shiftBite)` named a cell worth **+1.02 places**. On eight fresh seeds
over four stages the same cell measured **-0.03**. The cell that shipped (`gearCost` 1.5,
`shiftBite` 0.62) reads +0.17 against never shifting on one seed set and -0.06 against
mashing the chevrons on another. Same sim, opposite verdicts. `tools/gearing.js` therefore
splits its output: mechanism gates are asserted, balance numbers are only ever reported.

For scale: Feed craft measures about half a place and was already marginal. Gearing measures
less than that, and it costs a control.

**Harness limit, stated rather than used as an excuse.** The shifting policy is a reactive
servo that corrects whenever it is outside the band, about 250 times a stage. A person shifts
a handful of times and ANTICIPATES the ramp, which is the actual skill and the one thing the
harness cannot do. So it may understate a human's edge. It cannot be trusted to overstate it
either, and that is precisely why this is a question for the hand.

**What was verified directly, and does hold.** Cadence responds to gear and speed as designed;
past `cadMax` the power is capped rather than taxed, so being spun out is a real limit; a shift
at full effort drops power ~15% for 0.34s while a shift while soft-pedalling costs exactly
nothing (`shiftLoad` 0.80 against 0.00). That asymmetry is the whole reason to shift before
the ramp, and it is the one piece of this that is unambiguously working.

**Scaffolding with an expiry date.** `CFG.gearsOn` is false in a shipped build, the race
records the rule at creation so an in-progress stage never changes underneath a result, and
the golden passes with no regeneration. If gearing ships, the golden regenerates and the branch
stops being a branch. If it does not, the branch comes out. It must not quietly become
permanent.

Two things a measurement can never answer and Kevin's hands can: whether shifting is
satisfying or admin, and whether the chevrons at the ends of the action row are reachable
without breaking the pedalling rhythm.

## The power meter reads what you can hold, not how you pedal (build 22)

Kevin's proposal was to make the power meter powerful by replacing the LEGS gauge with the
TT rhythm bar and tying speed to pedalling quality: faster for good pedalling, slower for
bad. Both halves were refused, and then the replacement idea was refused too, and the third
answer is the one that shipped. The route there is worth keeping, because each step was
killed by a fact rather than by taste.

**A tactic must never sell speed.** Feed craft measures under half a placing, and the
division strength ramp deleted in build 16 for being an unfair escalator was 3.5% raw
speed. Any tactic granting a raw percentage dwarfs every other number in the game, becomes
a must-pick, and turns information into something you buy performance with. A power meter
does not produce watts in life either; it is a display.

**Replacing LEGS is a deletion, not a replacement.** LEGS is energy, the power meter reads
effort. They are different quantities. Gating the bar that tells you whether you are about
to crack behind a purchase is punitive and unrecoverable.

**Then the road-cadence idea died on the input model, which is the interesting one.** The
plan was to give the road a moving cadence target, unified with the TT so nobody learns two
systems. Kevin asked how it would affect jumps, sprints and attacks, and the answer killed
it. Laying the numbers out: tempo is 2.0 strokes/s, "attack" is labelled at 3.2, effort
saturates at 4.0, and three alternating strokes inside 0.6s fires a jump. A target near 3.4
sits **above** the attack threshold and **below** a sprint, so a sprint for the line would
read "too fast", a jump would read wildly off, and steady riding would read "too slow".

The reason is structural, not tunable. **Real cadence exists because gears let you make the
same power two ways.** This game has no gear, so rate IS power, there is no such thing as
grinding, and a cadence target can only ever mean "hold this exact power" — a rhythm-game
instruction that collides with every aggressive move, because those moves are defined by
leaving that power. No band width fixes it. (An earlier note in this conversation claimed
grinding a big gear should burn more fuel. You cannot grind in this game.)

That also explains why the TT rhythm works and is not an oversight: alone, at threshold,
with no attack and no sprint, "hold this power" genuinely IS the whole stage.

**What shipped instead: the meter reads sustainability.** The sim already computes something
rich and completely invisible — the same effort costs radically different amounts depending
on gradient, climbing economy and shelter — and you only ever found out by cracking. The
meter now reads seconds until the legs are gone, plus a 10s projection slice on the LEGS
gauge. Measured with `tools/outlook.js` at 2.4 strokes/s on 70 legs:

| | on a wheel | in the wind |
|---|---|---|
| flat | 37s | 17s |
| 4% | 24-28s | 13-15s |
| 9% | 16-21s | 10-13s |

A 3.7x span corner to corner, and the climbing body separates the rows (climber 21s against
rouleur 16s at 9% on a wheel). It is information, it needs no new control, and it does not
collide with attacking, because an attack is knowingly going over your ceiling and that is
the point.

**Two implementation rules this locked in.** The rate is RECORDED by `stepRider` as
`r.dE` at the moment it is applied, never recomputed in the view: recomputing is exactly how
the abandonment line ended up calculated in one function and displayed from another.
And the thresholds are calibrated to what the sim does rather than to what sounds right —
everything above tempo is a matches-burning regime measured in SECONDS, so the first pass
(a 30s redline, a 90s warning) would have painted the gauge red for the entire race.

**Still open:** Kevin wants to ride this before deciding whether to try the gear control,
which is the only thing that would make real cadence possible. That is a new control on a
two-thumb interface and probably a port-era conversation.

## The cobbles pack, and the test shortcut behind a gesture (build 21)

**The cobbles pack was the one that could not be built, and the reason was a category
error.** A route stamps a GRADIENT into the terrain, and pave has no gradient, so the pack
sat advertised and empty while the other two shipped. The machinery was there the whole
time: `SURFACES.cobbles` already carries drag, jostle, lost grip, punctures, and — the one
that matters — **drafting cut to 0.62**, which is what turns a sector from a tax into the
moment a race comes apart. All it needed was a second KIND of route: `isSector()`, stamped
into the surfaces list rather than the terrain, and assigned to FLAT days rather than
mountain ones, because pave decides a flat race and would be invisible on a col.

One sector per race, never one per flat day: a cobbled stage is an event, and pave
everywhere is wallpaper. Sectors are rated in stars, not gradients, and described by what
they do to you — a sector listed like a climb printed "at undefined%".

**The test shortcut is behind a gesture now**, which retires the pre-ship blocker in
CLAUDE.md. It used to be a plainly labelled Settings button handing over the $4.99 career
and every $2.99 pack for free, rewriting a real save to do it. Hold the build number for
five seconds, type the passphrase, and a Debug button appears with a diagnostics page:
the whole save dumped as text, division jumps, money, unlock toggles, and the two escape
hatches for a stuck save (clear the saved tour, clear the held tour). The flag is NOT
persisted, so a shipped build starts clean every time and one session never leaks into the
next.

## The free roads are real roads too (build 20)

Kevin: "I'm thinking we might want all our free routes to be based on real routes... seeing
real routes throughout the game is more exciting than unnamed routes."

The instinct is right. What was pushed back on, and why:

- **Real route DATA for the whole free game was rejected.** Three reasons. It erodes what
  the packs sell (today a pack is *a road with a name* against unnamed stages; if everything
  is a real named route, the pitch collapses to famous-ness). The three display scales mean
  real profiles do not import — Alpe d'Huez works because it is hand-authored to the numbers
  you read WHILE RIDING with the summit pinned, so a free catalogue means a hundred bespoke
  authorings or reconciling all three scales, which changes every course. And a catalogue
  repeats where the generator does not: a clean run from Division 8 to 1 is ~72 stages before
  the 21-stage tour and the 14-stage Grand Tour.
- **What shipped instead: real named CLIMBS on generated stages, plus a name on every
  stage.** The excitement is in the name, not the elevation data, and `assignRoute` already
  stamped a named climb into a generated stage and gated purely on ownership. So the free
  tier needed NO new system — just roads that are always owned.

Rules that keep the packs worth buying:

- **Free roads come from ranges no pack claims** (the Vosges, the Jura, the Massif Central),
  so free content can never cannibalise premium content.
- **Paid roads are placed FIRST and take the decisive stages**; free roads only fill what is
  left. The grand tour showcase (every road you own gets its day, the last on the last
  mountain) is unchanged.
- **Every mountain day gets a name now**, not just seven-day tours. `assignRoute` used to
  bail below seven stages, so a rider doing the short and medium races the ladder ASKS FOR
  never saw a named road at all.

**Every stage is titled from a town to a town**, derived from the seed, never drawn from the
course PRNG (DEV-LOOP: derive, never add an `R()` call) and living entirely in the view — so
generation is untouched, the golden does not move, and the daily's shared board stays fair.
A summit finish is titled for the summit; a pass is just a road on the way somewhere, which
is how real races name a day.

**Two things the audit found on the way:**

- **The Pyrenees pack was an empty box.** `ROUTE_PACKS` advertised it and `ROUTES` contained
  no Pyrenean road at all. The shop was honest about it (it rendered "in the works" with the
  buy button disabled, so nobody could spend money on air), but one of three advertised packs
  was the entire paid catalogue. It now holds the Tourmalet, the Aubisque and Peyresourde.
  The cobbles pack stays "in the works" on purpose: cobbled sectors are SURFACES, not climbs,
  so it needs machinery the route system does not have.
- **`renderPractice` hand-rolled its own ownership check** instead of calling
  `ownedRoutes()`, so the free roads were invisible there — the same producer-versus-consumer
  split that made abandoning a tour lock the game. One function decides now.

## A locked control must say why, or it reads as a broken one (build 19)

Kevin: "The body UI needs some updating because it seems like a bug that you can't change
anything. It needs to be designed better so people know they need to unlock it first."

**The root cause was `title`.** Physique put "needs Climbing IV" and the price in tooltip
attributes, and a touch screen never shows a tooltip — and this game is going to iOS. So
the row was five greyed, disabled, silent buttons, and reading that as a bug is the correct
reading. Training, three inches below, had the same states as VISIBLE BUTTON LABELS all
along ("Needs Climbing III", "Buy · 700"), which is why the fix was to make physique speak
the language training already spoke rather than invent one.

The rules that came out of it, applied to both sections:

- **Nothing is `disabled`.** A disabled button does not fire a click, so the player taps it,
  nothing happens anywhere on screen, and they conclude it is broken. Every state is now
  tappable and answers in a caption: what it needs, what it costs, how short you are.
- **Every state is text, never colour or opacity alone.** "BUY 800" against "1200 SHORT",
  not orange against grey.
- **Physique is CARDS, the same as the bike parts** (Kevin's call, and it is the right one).
  A segment was the wrong widget twice over: too narrow to hold "needs Climbing IV", so the
  explanation ended up in a tooltip; and its whole convention is free, reversible selection
  while these cost real prize money. A first pass tried to rescue the segment with a state
  sub-line and an arm-then-buy tap. Cards make both unnecessary — the words fit, and a
  card's own Buy button is already a deliberate press. Group selector then a strip, exactly
  the shape the bike uses, so ten options do not fill the screen. **One state language
  across the whole build screen now: `locked` / `for sale` / `worn` / `fitted`.**
- **Show the balance where the prices are.** The build screen showed prices in three
  sections and your money in none of them, so every number was unanchored.

Two real bugs fell out of the audit, both of the "inert control" family:

- **A training block could get stuck in your save.** `fittedTraining` skips a block that no
  longer fits the budget, so `on` went false, `room` went false, the button read "No room"
  and was **disabled** — and the only code that removes an id from `ladder.training` is that
  button's own click handler. Drop a division (which shrinks the budget) while carrying
  blocks and one was stuck forever. It now says "Over budget · drop" and lets go.
- **The segmented row was clipping.** Five long names ("Featherweight", "Powerhouse") in a
  `nowrap` strip with `overflow:hidden` sliced the last option in half at the right edge,
  before any of this was added. The body rows wrap and size to fit.

## Abandoning a tour locked you out of racing, three different ways (build 18)

Kevin: "When you abandon a tour, when you try to start a tour again it says you need to
finish the other one first, but you abandoned it so you can't."

The blocking state is `ladder.heldTour`, not `savedTour` (abandon clears that correctly).
`renderPick` greys a race card when `held.len !== r.len`, and the abandon handler wrote
`{ seed, build }` with **no `len` at all** — so the test was `undefined !== 1`,
`undefined !== 3` and so on, true for every row. Every button read "Finish the other one
first" and was disabled, and the only code that clears `heldTour` lives inside `newTour`,
behind those disabled buttons. A permanent, unrecoverable save.

Two more routes to the same dead end were found while fixing it, and neither is exotic:

- **Relegation.** Abandon a three-week tour (the only row with `minDiv: 3`) and the
  abandonment itself can relegate you below Division 3, which filters that row off the
  screen — while it still holds every other row hostage.
- **A resumed Grand Tour.** `saveTour` dropped `grand`, so a resumed one had
  `tour.grand === false` and abandoning it wrote `heldTour.len = 14`. No menu row is 14.

The structural fix is one predicate, `heldLenOffered`, used by BOTH `renderPick` and
`newTour`: **a held length the picker cannot offer holds nothing.** The seed and the build
are still restored either way, so the no-reroll rule survives intact and only the length
comes free, and only when the game itself withdrew the race. Using the same predicate in
both places is what stops the button's LABEL and what the button DOES from drifting apart,
which is how this was born.

**`saveTour` was also dropping paid content.** It persisted seven of the tour's fields and
skipped `grand`, `restAfter` and `routeMap`. `routeMap` drives `stageRoute`, so **the named
climbs from a $2.99 route pack vanished from every stage after a resume** — silently. Rest
days disappeared from resumed three-week tours for the same reason. All three are now saved
and restored, and a pre-fix save rebuilds its rest days from its own length.

The lesson, and it is the one already in CLAUDE.md: a producer and a consumer disagreed
about the shape of one object, and the field they disagreed about was the one the lock keyed
on. `career.py` now asserts all three lockout paths plus the ordinary held-tour case.

## CORRECTED: the AI's drop-back was never slow (build 18's claim, retracted in build 21)

**Build 18 recorded that a rival's swing takes a median 11.91s against the code's own claim
of four to six. That number was wrong, and it was mine.** The harness timed contiguous runs
of `r.swingOff`, and that flag is re-armed by three separate paths (turn expiry, being
relieved, and the stay-out-until-you-are-behind rule), so a single run chained several
swings into one. It was reported to Kevin as a defect and written into two docs before
anyone measured the thing itself rather than the flag.

`tools/aiswing.js` now measures front-handover to behind-the-last-wheel:

| | median | worst |
|---|---|---|
| a rival | **3.17s** | 4.83s |
| the player (`easeCut`) | 3.3s | 8.9s |

So rivals drop back slightly FASTER than you do, and the design's "four-to-six seconds" is met
at both ends.

**★ THE TAIL IN THIS TABLE USED TO READ 39.07s, AND THAT WAS THE SAME HARNESS BEING WRONG A
SECOND TIME (corrected build 32).** The fix above stopped it timing the flag; it still started
its clock whenever `race.breakFront` changed, including in breaks that were NOT ROTATING, where
that name only means "whoever is furthest up the road". Instrumented, every long run had
`race.rotating` false and `swingOff` 0 for its whole length: the rider was never relieved and
was never dropping back. Gating the trigger on `race.rotating` collapses the worst case from
39.07s to 4.83s. There was never a tail, so there was never anything for the rewrite to fix.

**A distance-budget swing exists behind `CFG.swingBudget` (rebuilt build 32) and is worse.**
It replaces the fixed pace cut with "work out how far you still have to drop and take the
deficit that clears it in four seconds", which is the more principled question and still loses
on every axis: median 3.90s against 3.17s, worst 28.68s against 4.83s, with that tail entirely
its own. The floor is why — a 13 m gap asks for about 75% of the front's pace and the 0.82
floor binds before that, so the budget ends up weaker than the flat cut it replaced. Build 21
recorded it as halving the tail; that figure was the ungated trigger, not the mechanism.

It stays behind the toggle because Kevin asked to ride it and feel is the one question a
harness cannot answer. If it does not feel better, delete the branch. Do not tune it: there is
no problem left for it to solve.

The old entry's conclusion still stands on its own terms and is worth keeping: **raising
`swingCut` breaks the rotation rather than speeding it up.** Swept against the refusal
mechanic, which is the only gate that sees it:

| swingCut | refusal |
|---|---|
| 0.09 (shipped) | passes |
| 0.12 | passes |
| 0.14 and above | no elbow flick, or the break never sits up |

Traced at 0.32: the mates swing off, blow far past the last wheel and never come back
through, sitting 2-4 m behind a rider merely holding a steady wheel. That rider leads by
default, `sinceTurn` resets every frame, and the wheel-suck escalation can never fire. The
second chance (7/7, 7/7) and dominance both PASSED at 0.32 — only refusal caught it.

## The mechanics suite gives a FALSE GREEN on the swing constants

Verified, build 17. Set `CFG.swingCut` to 0.12 (from 0.09) and **all 38 mechanics tests
pass while the golden master fails** — finishing order, times, points and MONEY, so the
economy moves silently. Anyone who changes a swing constant and runs only
`node tools/tests/run.js` will ship that.

The mechanism is a hardcoded clamp. The tutorial drill (`index.html:8896`) pins a swinging
AI to `y.speed * 0.90`, and FOUR test files replicate that `hold()` verbatim
(rotation-dropback, rotation-recall, rotation-rejoin, refusal), because DEV-LOOP tells you
to copy it. Measured with the clamp, the deepest swinger speed is 0.836 / 0.836 / 0.834 of
the front's across `swingCut` 0.09 / 0.16 / 0.28 — essentially INSENSITIVE across a 3x
change. Free of the clamp the same values are 0.440 / 0.410 / 0.362. The drill and the
tests both mask it, which is the "both halves exist, check they are in the same scope"
failure in CLAUDE.md wearing a different hat.

**So: any change to `swingCut`, `swingLen` or `turnLen` must be verified against the
GOLDEN, not the mechanics suite.** Related, also measured: `swingLen` feeds the rotation
cycle formula at `index.html:2324`, which derives `grace`, `warnAt` and `giveAt` — so it
silently moves the elbow flick and the break sit-up. The refusal test asserts ORDERING but
not TIMING, so the flick drifted 76.0s to 110.6s while staying green.

`CFG.easeCut` is exempt from all of this: it is read on ONE line, only for the player, only
while returning after a pull, and the golden's cases never put the player in that state
(verify passes 1590/1590 with no regen at 0.45, while the drop-back test moves 5.9s to 3.2s).

## Coasting is not soft-pedalling, and that may be the sluggishness you feel

Also verified in build 17, and NOT changed, because changing it means touching the drafting
model. `CFG.easeCut` only engages when `effVal < CFG.tempo * 0.85` (0.731). Holding BOTH
PADS sets `ev = CFG.ease` (0.58), so it fires. Simply STOPPING TAPPING sets
`ev = carried = CFG.idle + (tempo - idle) * draft`, which is 0.815 to 0.86 — **above the
gate, so nothing happens at all.**

That is the drafting model working as designed: sitting in is cheap, so coasting on a wheel
costs about what holding it costs, and going BACKWARDS has to be an active gesture. The
drill teaches exactly this ("Both pads at once is soft pedalling"). But it does mean a
player who expects "stop pedalling and drift back" gets nothing, which is word for word the
original "it's like it's capping you from slowing down" complaint. If that is still the
feel after build 17, the fix is the gate or the idle floor, not `easeCut`, and it touches
how drafting works for everyone.

## Design pillars

**Race craft: the game never tells you, but rewards you for knowing.** A "Race craft"
section on the rules page NAMES each thing and hints without explaining, because an Easter
egg nobody finds is wasted work but one you are handed is not an Easter egg.

Verified true in the sim: the crosswind shelter really does sit off to one side; sitting in
and launching late really does beat going long; a full stomach really does climb badly.

**Never ship a hint you have not measured.** Two of the original seven were false.

## The three display scales disagree, and always have

`gradePct 15`, `elevM 7` and `altM 2.7` each imply a different metres-per-elevation-unit,
because each was tuned independently to look right in its own context. A climb authored to
DISPLAY 8.1% reports only 522m of climbing against a real 1120m.

Consequences:
- Climbs are authored to the numbers you read WHILE RIDING (length and live gradient land
  exactly), with the summit pinned explicitly.
- Climb categories for GENERATED climbs are calibrated to this game's distribution, not to
  real metres — real thresholds rated 197 of 201 climbs as HC.
- Climb categories for NAMED ROUTES use their real figures and real thresholds, so Alpe
  d'Huez reads HC as it should.
- The stage-wide "total climbing" figure under-reports on route stages. Fixing it means
  reconciling all three scales, which changes every existing course.

## Monetization

**Five real roads are free** (build 20), drawn from ranges no pack claims, so every
mountain day of every tour climbs a named col whether you have paid or not. Packs add
the famous ones and take the stages that decide a race.

Free download, never ads. One **$4.99 unlock** granting the ABILITY to earn the career
(divisions, rider growth, gear) rather than handing any of it over. **$2.99 route packs**.
Prize money buys routes, bike parts, physique and training; real money buys them faster.
The daily is free. The ladder is never pay-to-skip, which now means specifically that money
never skips an UNLOCK (see "The economy, as shipped").

Route packs get dearer as you collect them: **3,000 / 6,000 / 12,000, capped at 18,000**
(the price of three three-week tours). Priced by how many you own, not which pack, so
buying in any order is fair.

Still undecided: where the free taste ends.
