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
  originally. `CFG.swingCut` is the knob if it feels sluggish in the hand.
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

Free download, never ads. One **$4.99 unlock** granting the ABILITY to earn the career
(divisions, rider growth, gear) rather than handing any of it over. **$2.99 route packs**.
Prize money buys routes, bike parts, physique and training; real money buys them faster.
The daily is free. The ladder is never pay-to-skip, which now means specifically that money
never skips an UNLOCK (see "The economy, as shipped").

Route packs get dearer as you collect them: **3,000 / 6,000 / 12,000, capped at 18,000**
(the price of three three-week tours). Priced by how many you own, not which pack, so
buying in any order is fair.

Still undecided: where the free taste ends.
