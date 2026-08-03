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
- **A presence-percentage rule for the musette** ("in the lane 90% of the line").
  A hidden meter: failing a grab at 85% reads as a random denial. Same intent, readable
  rule instead: the hand-up sits at 0.60 of the zone, and the pass is LATCHED — be in
  the soigneur's lane as you cross the start of the line and stay on it, or no bag.
- **Bib 0.** Road racing has no bib 0, and the deviation bought nothing. The picker is
  1-9: one digit is what fits a rider drawn at this scale (rivals wear 11-78).
- **Making 4-6 rider breaks rotate** (decided 2026-08, option "leave it"). The group
  detector calls the largest group "the peloton", and in an 8-rider field a 4+ break IS
  the largest group, so through-and-off never engages for it. This deviates from real
  racing — a 5-rider move up the road is still the break — but the fix means redefining
  the peloton, which chase, the driver and mass shelter all hang off. A corner case at
  this field size; documented as a known gap in MECHANICS.md. Revisit (as "peloton =
  group with most GC riders" or "rearmost large group") if fields ever grow beyond 8.

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
Prize money buys routes; real money buys them faster. The daily is free. The ladder is
never pay-to-skip.

Route packs get dearer as you collect them: **3,000 / 6,000 / 12,000, capped at 18,000**
(the price of three three-week tours). Priced by how many you own, not which pack, so
buying in any order is fair.

Still undecided: where the free taste ends.
