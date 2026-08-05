#!/usr/bin/env python3
# Career/progression browser tests: seeded saves in, rendered DOM out.
#
# The view's closure state (ladder, race, tour) is unreachable from evaluate, so
# the DOM is the contract. The page persists through window.storage (async
# get/set), which the browser does not provide, so each case installs a shim
# backed by localStorage in a context init script and seeds the save through it.
# What the screens then display is what gets asserted.
#
# Checks:
#   1. Division display     - seed div 5, the menu says "Division 5 of 8".
#   2. Route pack pricing   - 3000 / 6000 / 12000 capped at 18000, BY COUNT
#                             OWNED, not by pack: the alps card is kept unowned
#                             while other ids fill the packs list, so its
#                             displayed price must climb the ladder.
#   3. Money display        - seeded money renders in the menu status line and
#                             as the routes-screen balance.
#   4. Result recording     - complete one shrunk one-day race (pedal z/x),
#                             then the palmares says one more race than seeded,
#                             the saved history grew by one, ladder.tours
#                             ticked, and the save matches the placing rule
#                             (top three at Division 8 promotes when the medium
#                             credit is already held; outside it holds).
#
# Runs against a THROWAWAY copy of index.html (tutorial default bypassed, the
# flat and hills stages shrunk so a race takes ~30s). Never touches the real
# file. Math.random is seeded in the race case so the course draw is fixed.
#
# Env:
#   PW_CHROMIUM    - chromium executable override; defaults to
#                    /opt/pw-browsers/chromium when that path exists.
#   CAREER_INDEX   - alternate index.html to test (mutation evidence only).
#   CAREER_SCRATCH - where to build the throwaway copy (default: a temp dir).
#
# Exit 0 only if every check passes. One line per check, final PASS/FAIL line.

import asyncio
import json
import os
import pathlib
import re
import sys
import tempfile
import time

from playwright.async_api import async_playwright

REPO = pathlib.Path(__file__).resolve().parents[2]

RESULTS = []


def check(name, cond, detail=""):
    RESULTS.append(bool(cond))
    print(("ok   " if cond else "FAIL ") + name + (" - " + detail if detail else ""),
          flush=True)
    return bool(cond)


def build_throwaway(scratch):
    src = pathlib.Path(os.environ.get("CAREER_INDEX", str(REPO / "index.html")))
    html = src.read_text(encoding="utf-8")
    subs = [
        # tutorial bypass: make the DEFAULT ladder tutorial-done, so the start
        # button can never race the async save load into the tutorial
        ("let ladder = { div: 8,", "let ladder = { div: 8, tutorialDone: true,"),
        # shrink both one-day draws (flat and hills) so a race takes ~30s
        ("len: 1400", "len: 320"),
        ("len: 1550", "len: 320"),
        # Publish what the HUD decided to show about the RIVALS, so the radio gating
        # can be asserted rather than eyeballed. drawHud is a view closure and
        # unreachable from evaluate, and "a readout that should be hidden is showing"
        # is exactly the class the sim tests cannot see. Inert otherwise: it only
        # writes to a window object.
        # Init at the TOP of drawHud, not inside the road-race branch: a time trial never
        # enters that branch, and the POWER gauge is now asserted on a TT.
        ("  const c = C(), you = race.you, pad = Math.max(14, W * 0.045);",
         "  const c = C(), you = race.you, pad = Math.max(14, W * 0.045);\n"
         "  (window.__hud = window.__hud || { pips: 0 }).radio = (you.stats.radio || 0);\n"
         "  window.__hud.tt = (race.spec && race.spec.tt) ? 1 : 0;"),
        ("  if ((you.stats.radio || 0) >= 2) {\n"
         "    label(leader === you ? \"LEADING\"",
         "  if ((you.stats.radio || 0) >= 2) {\n"
         "    window.__hud.leader = 1;\n"
         "    label(leader === you ? \"LEADING\""),
        ("    const lo = Sim.CFG.ease;",
         "    window.__hud.power = 1;\n"
         "    const lo = Sim.CFG.ease;"),
        # The power meter now reads SUSTAINABILITY, and the reading is the feature. Publish
        # the string the gauge actually labels itself with, plus the raw rate behind it, so
        # a test asserts what is on screen rather than re-deriving the arithmetic and then
        # asserting its own copy of it.
        # RECORD ACROSS FRAMES, DO NOT SAMPLE ONE. A road stage opens with a neutral
        # roll-out where the sim zeroes the energy rate outright, so a single read at the
        # end of the case can land on dE 0 and "COMING BACK" and prove nothing about the
        # number the feature is built on. Keeping the extremes is the same shape the
        # profile-strip counter already uses.
        ("    const pmRead = you.cracked ? \"EMPTY\"",
         "    window.__hud.dE = you.dE === undefined ? null : you.dE;\n"
         "    window.__hud.dEmin = Math.min(window.__hud.dEmin === undefined ? 0 : window.__hud.dEmin, you.dE || 0);\n"
         "    if (ttl !== Infinity) window.__hud.ttlMin = Math.min(\n"
         "      window.__hud.ttlMin === undefined ? 1e9 : window.__hud.ttlMin, Math.round(ttl));\n"
         "    const pmRead = you.cracked ? \"EMPTY\""),
        ("    if (pmLvl >= 2) label(pmRead,",
         "    if (pmLvl >= 2) window.__hud.pmRead = pmRead;\n"
         "    if (pmLvl >= 2) label(pmRead,"),
        # The projection slice on the LEGS bar is the OTHER half of level II, and it is
        # drawn from a different place in drawHud. Count it separately: the build-15 lesson
        # is that one gated surface passing says nothing about the others.
        ("  if (pmLvl >= 2 && !you.cracked && Math.abs(you.dE || 0) > 0.05) {",
         "  window.__hud = window.__hud || { pips: 0 };\n"
         "  window.__hud.projGate = pmLvl >= 2 ? 1 : 0;\n"
         "  window.__hud.proj = window.__hud.proj || 0;\n"
         "  if (pmLvl >= 2 && !you.cracked && Math.abs(you.dE || 0) > 0.05) {\n"
         "    window.__hud.proj++;"),
        # COUNT THE RIVAL TICKS ON THE PROFILE STRIP. Build 15 gated the pip rail, shipped
        # a passing test proving the rail was silent, and left this loop painting the whole
        # field across the whole stage for free. Counting the rail alone is what let that
        # through, so every rival-drawing surface is now counted separately.
        ("  if ((you.stats.radio || 0) >= 2) for (const r of race.riders) {\n"
         "    if (r === you) continue;\n"
         "    ctx.fillStyle = r.c;",
         "  window.__hud = window.__hud || { pips: 0 };\n"
         "  window.__hud.stripGate = ((you.stats.radio || 0) >= 2) ? 1 : 0;\n"
         "  window.__hud.strip = window.__hud.strip || 0;\n"
         "  if ((you.stats.radio || 0) >= 2) for (const r of race.riders) {\n"
         "    if (r === you) continue;\n"
         "    window.__hud.strip++;\n"
         "    ctx.fillStyle = r.c;"),
        ("  const pips = [];\n"
         "  if ((you.stats.radio || 0) >= 3) for (const r of race.riders) {",
         "  const pips = [];\n"
         "  if (window.__hud) window.__hud.pipGate = ((you.stats.radio || 0) >= 3) ? 1 : 0;\n"
         "  if ((you.stats.radio || 0) >= 3) for (const r of race.riders) {"),
        ("  pips.sort((a, b) => a.x - b.x);",
         "  if (window.__hud) window.__hud.pips = Math.max(window.__hud.pips || 0, pips.length);\n"
         "  pips.sort((a, b) => a.x - b.x);"),
    ]
    for old, new in subs:
        n = html.count(old)
        if n != 1:
            print("FAIL harness - expected exactly 1 occurrence of %r in %s, found %d"
                  % (old, src, n))
            print("CAREER: FAIL")
            sys.exit(1)
        html = html.replace(old, new, 1)
    out = scratch / "career-index.html"
    out.write_text(html, encoding="utf-8")
    return out


def init_script(ladder, history, rand_seed=None):
    js = """
(() => {
  let backing;
  try {
    localStorage.setItem("__probe", "1"); localStorage.removeItem("__probe");
    backing = localStorage;
  } catch (e) {
    const m = new Map();
    backing = {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => { m.set(k, String(v)); },
      removeItem: k => { m.delete(k); },
      clear: () => { m.clear(); }
    };
  }
  try { backing.clear(); } catch (e) {}
  backing.setItem("slipstream:ladder", %s);
  backing.setItem("slipstream:history", %s);
  window.__slipTestStore = backing;
  window.storage = {
    get: async k => { const v = backing.getItem(k); return v == null ? null : { key: k, value: v }; },
    set: async (k, v) => { backing.setItem(k, String(v)); },
    delete: async k => { backing.removeItem(k); }
  };
""" % (json.dumps(json.dumps(ladder)), json.dumps(json.dumps(history)))
    if rand_seed is not None:
        # seeded mulberry32 in place of Math.random: the only view-side uses are
        # the tour seed and abandon flavour text, so this fixes the course draw
        js += """
  let a = %d | 0;
  Math.random = function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
""" % rand_seed
    return js + "})();"


async def launch(p):
    exe = os.environ.get("PW_CHROMIUM")
    if not exe and os.path.exists("/opt/pw-browsers/chromium"):
        exe = "/opt/pw-browsers/chromium"
    if exe:
        return await p.chromium.launch(executable_path=exe)
    return await p.chromium.launch()


async def open_case(browser, url, ladder, history, errs, rand_seed=None):
    ctx = await browser.new_context()
    ctx.set_default_timeout(15000)
    await ctx.add_init_script(init_script(ladder, history, rand_seed))
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(url)
    # the save loads asynchronously; the money suffix in the menu status line
    # only exists once the seeded ladder (tours > 0) has been merged in
    await pg.wait_for_function(
        "() => document.getElementById('mStat').textContent.includes(%s)"
        % json.dumps("%d prize money" % ladder["money"]))
    return ctx, pg


async def read_routes(pg):
    await pg.click("#routesBtn")
    await pg.wait_for_selector("#routes:not(.hide)")
    await pg.wait_for_function(
        "() => document.querySelectorAll('#routesBody .card').length === 3")
    return await pg.evaluate("""() => {
      const paras = [...document.querySelectorAll('#routesBody p.sub')].map(p => p.textContent);
      const card = document.querySelector('#routesBody .card');   // alps is first
      const btn = card ? card.querySelector('.btns button') : null;
      const big = document.querySelector('#routesBody b');        // the balance figure
      return { priceLine: paras.find(t => /costs \\d/.test(t)) || null,
               btnText: btn ? btn.textContent : null,
               big: big ? big.textContent : null };
    }""")


def btn_price(btn_text):
    m = re.search(r"\d+", btn_text or "")
    return int(m.group(0)) if m else None


def para_price(price_line):
    m = re.search(r"costs (\d+)", price_line or "")
    return int(m.group(1)) if m else None


async def main():
    t0 = time.monotonic()
    scratch = pathlib.Path(os.environ.get("CAREER_SCRATCH")
                           or tempfile.mkdtemp(prefix="slipstream-career-"))
    scratch.mkdir(parents=True, exist_ok=True)
    url = build_throwaway(scratch).as_uri()
    errs = []

    async with async_playwright() as p:
        browser = await launch(p)

        # ---- 1. division display --------------------------------------------
        ladder = {"tutorialDone": True, "div": 5, "tours": 1, "money": 4242}
        ctx, pg = await open_case(browser, url, ladder, [], errs)
        mdiv = await pg.text_content("#mDiv")
        check("division display", mdiv == "Division 5 of 8",
              "seeded div 5, menu shows %r" % mdiv)
        await ctx.close()

        # ---- 3. money display (menu + routes balance) -----------------------
        ladder = {"tutorialDone": True, "tours": 1, "money": 7777}
        ctx, pg = await open_case(browser, url, ladder, [], errs)
        mstat = await pg.text_content("#mStat")
        check("money display (menu status)", "7777 prize money" in mstat,
              "seeded 7777, status line shows it")
        r = await read_routes(pg)
        check("money display (routes balance)", r["big"] == "7777",
              "balance figure shows %r" % r["big"])
        await ctx.close()

        # ---- 4b. abandoning a tour must not lock you out of racing -----------
        # Kevin: "When you abandon a tour, when you try to start a tour again it says you
        # need to finish the other one first, but you abandoned it so you can't."
        # renderPick greys a card when `held.len !== r.len`, and the abandon handler wrote
        # heldTour WITHOUT a len, so `undefined !== 1/3/5/7` was true for every card and
        # every button was disabled. A permanent, save-killing lockout with no way out.
        async def pick_buttons(lad):
            ctx, pg = await open_case(browser, url, lad, [], errs)
            try:
                await pg.click("#startBtn")
                await pg.wait_for_selector("#pick:not(.hide)")
                return await pg.evaluate(
                    "[...document.querySelectorAll('#pickBody .card')].map(c => ({"
                    " name: c.querySelector('b').textContent,"
                    " text: c.querySelector('.btns button').textContent,"
                    " disabled: c.querySelector('.btns button').disabled }))")
            finally:
                await ctx.close()

        base = {"tutorialDone": True, "div": 8, "tours": 2, "money": 500}
        rows = await pick_buttons(dict(base, heldTour={"seed": 12345, "len": 3}))
        three = [r for r in rows if r["name"] == "Three-day tour"]
        others = [r for r in rows if r["name"] != "Three-day tour"]
        check("held tour: the held LENGTH is rideable",
              bool(three) and not three[0]["disabled"],
              "three-day card %r" % (three,))
        check("held tour: the other lengths are held back",
              bool(others) and all(r["disabled"] for r in others),
              "others %r" % ([r["name"] for r in others if not r["disabled"]],))

        # The save-recovery half: a heldTour with NO len is a pre-fix save, and it must not
        # lock every option. Without this, an already-abandoned save is bricked forever.
        rows = await pick_buttons(dict(base, heldTour={"seed": 12345}))
        stuck = [r["name"] for r in rows if r["disabled"]]
        check("held tour with no length recorded never locks the player out",
              rows and not stuck,
              "still disabled: %r" % (stuck,))

        # A length the picker cannot offer holds NOTHING. 14 is the Grand Tour's length,
        # which a resumed-then-abandoned grand tour used to write into heldTour, and no
        # RACE_MENU row is 14 — so the lock had nothing to point at and disabled everything.
        rows = await pick_buttons(dict(base, heldTour={"seed": 12345, "len": 14}))
        stuck = [r["name"] for r in rows if r["disabled"]]
        check("a held length the picker cannot offer holds nothing",
              rows and not stuck,
              "still disabled: %r" % (stuck,))

        # Relegation must not withdraw the race you are holding. Hold the 21 (minDiv 3) and
        # sit at Division 4: the row used to be filtered out while still locking every other
        # row, which is the same dead end reached a third way.
        rows = await pick_buttons(dict(base, div=4, heldTour={"seed": 12345, "len": 21}))
        names = [r["name"] for r in rows]
        three_week = [r for r in rows if r["name"] == "Three-week tour"]
        check("relegation cannot withdraw the tour you are holding",
              bool(three_week) and not three_week[0]["disabled"],
              "cards rendered %r" % (names,))

        # ---- 5. race craft: carry TWO of three -------------------------------
        # The pool grew to three (radio / power meter / feed craft) and the limit to
        # two, so a free slot must FILL and a full one must EVICT the oldest. Two of
        # two was not a decision and one of three would have left the power meter
        # permanently unfitted once the radio absorbed every rival readout.
        ladder = {"tutorialDone": True, "div": 4, "tours": 3, "wins": 5,
                  "money": 1500, "tactics": ["radio"]}
        ctx, pg = await open_case(browser, url, ladder, [], errs)
        await pg.click("#buildBtn")
        await pg.locator("#build").wait_for(state="visible")

        async def craft():
            return await pg.evaluate(
                "Object.fromEntries([...document.querySelectorAll('#bTactics .card')]"
                ".filter(c => c.querySelector('.btns'))"
                ".map(c => [c.querySelector('b').textContent,"
                " c.querySelector('.btns button').textContent]))")

        st = await craft()
        check("race craft: the pool is three and one seeded fit shows as carried",
              len(st) == 3 and st.get("Race radio") == "Carrying"
              and st.get("Power meter") == "Carry this" and st.get("Feed craft") == "Carry this",
              "cards read %r" % st)
        await pg.locator("#bTactics .card", has_text="Power meter").locator(".btns button").click()
        await pg.wait_for_timeout(150)
        st = await craft()
        check("race craft: a free second slot fills without evicting",
              st.get("Race radio") == "Carrying" and st.get("Power meter") == "Carrying"
              and st.get("Feed craft") == "Carry this",
              "cards read %r" % st)
        await pg.locator("#bTactics .card", has_text="Feed craft").locator(".btns button").click()
        await pg.wait_for_timeout(150)
        st = await craft()
        carried = sorted(k for k, v in st.items() if v == "Carrying")
        check("race craft: a third choice evicts the oldest, never exceeds two",
              carried == ["Feed craft", "Power meter"],
              "carrying %r" % (carried,))
        saved = await pg.evaluate(
            "window.storage.get('slipstream:ladder').then(r => r ? JSON.parse(r.value).tactics : null)")
        check("race craft: the choice persists", saved == ["powerMeter", "feedcraft"],
              "saved tactics %r" % (saved,))
        await ctx.close()

        # ---- 5b. the power meter draws in a TIME TRIAL -----------------------
        # It was suppressed on the one day a real rider lives by power, which fell out
        # of "a time trial shows ONE thing" rather than any decision. Practice can ride
        # the race of truth directly, so this asserts it without needing a long tour.
        ladder = {"tutorialDone": True, "div": 4, "tours": 3, "wins": 5,
                  "money": 500, "tactics": ["powerMeter"]}
        ctx, pg = await open_case(browser, url, ladder, [], errs, rand_seed=42)
        try:
            await pg.click("#pracBtn")
            await pg.locator("#practice").wait_for(state="visible")
            await pg.locator("#pStages button", has_text="Time trial").click()
            await pg.click("#pRide")
            await pg.wait_for_selector("#build:not(.hide)")
            await pg.click("#bLock")
            # startPractice() goes through showBriefing(), same as a real race; skipping
            # the roll-out button meant the race never started and the HUD never drew.
            await pg.wait_for_selector("#brief:not(.hide)")
            await pg.click("#rollBtn")
            side = 0
            for _ in range(20):
                await pg.keyboard.press("z" if side == 0 else "x")
                side ^= 1
                await pg.wait_for_timeout(320)
            h = await pg.evaluate("window.__hud || null")
            check("power meter draws on the race of truth",
                  h is not None and h.get("tt") == 1 and h.get("power") == 1,
                  "hud reported %r" % (h,))
        finally:
            await ctx.close()

        # ---- 5c. the power meter READS SUSTAINABILITY ------------------------
        # The gauge used to smooth toward one of three fixed heights taken from the effort
        # LABEL, so it told you nothing your own thumbs had not. It now reads how long the
        # current effort can be held, off `dE` — the per-second energy rate the sim records
        # as it applies it. Three separate things are asserted because they are drawn from
        # three separate places and build 15 shipped exactly this shape of bug: the reading
        # itself, the projection slice on the LEGS gauge, and the level gating.
        # LEVEL COMES FROM CAREER WINS, not from a `powerMeter` field on the ladder. That
        # field is a leftover from when tactics arrived on a win-count drip; the live path
        # is raceStats -> tacticLevel -> WIN_STEPS.powerMeter = [2, 6, 11]. Seeding the
        # wrong key gives a rider at level 1 in both cases and a test that proves nothing,
        # which has already happened twice in this suite.
        for wins, lvl, want_read, want_proj in ((6, 2, True, True), (2, 1, False, False)):
            ladder = {"tutorialDone": True, "div": 4, "tours": 3, "wins": wins,
                      "money": 500, "tactics": ["powerMeter"]}
            ctx, pg = await open_case(browser, url, ladder, [], errs, rand_seed=42)
            try:
                await pg.click("#pracBtn")
                await pg.locator("#practice").wait_for(state="visible")
                # EXACT: "Flat" also matches "Pan flat", which is a strict-mode violation.
                await pg.locator("#pStages button", has_text=re.compile(r"^Flat$")).click()
                await pg.click("#pRide")
                await pg.wait_for_selector("#build:not(.hide)")
                await pg.click("#bLock")
                await pg.wait_for_selector("#brief:not(.hide)")
                await pg.click("#rollBtn")
                # PEDAL HARD ENOUGH TO ACTUALLY SPEND, and ride long enough to clear the
                # neutral roll-out, where the sim zeroes the energy rate outright. Below
                # tempo the legs only ever come back and the reading is "COMING BACK"
                # forever, which passes a sloppy assertion while proving nothing.
                side = 0
                for _ in range(120):
                    await pg.keyboard.press("z" if side == 0 else "x")
                    side ^= 1
                    await pg.wait_for_timeout(60)
                h = await pg.evaluate("window.__hud || null") or {}
                check("power meter L%d: the sim publishes an energy rate" % lvl,
                      h.get("dE") is not None, "dE %r" % (h.get("dE"),))
                got_read = h.get("pmRead") is not None
                check("power meter L%d: the reading %s" % (lvl, "shows" if want_read else "is held back"),
                      got_read == want_read, "read %r" % (h.get("pmRead"),))
                check("power meter L%d: the LEGS projection %s" % (lvl, "draws" if want_proj else "is held back"),
                      (h.get("proj", 0) > 0) == want_proj,
                      "projGate %r, frames %r" % (h.get("projGate"), h.get("proj")))
                if want_read:
                    # A REAL seconds-to-empty has to have appeared at some point in the
                    # ride, not just the "COMING BACK" that a resting rider shows. Asserting
                    # on the last frame would accept a reading that was never finite.
                    check("power meter: a finite seconds-to-empty was reached",
                          h.get("ttlMin") is not None and 0 < h["ttlMin"] < 1e9,
                          "lowest reading %r, hardest rate %r" % (h.get("ttlMin"), h.get("dEmin")))
            finally:
                await ctx.close()

        # ---- 4bis. the test shortcut is behind a gesture ----------------------
        # It used to be a plainly labelled Settings button handing over the $4.99 career and
        # every $2.99 pack for free. Now: hold the build number 5s, type the passphrase. The
        # assertions that matter are that it is INVISIBLE at rest (a shipped build must not
        # leak it) and that the debug screen is REGISTERED with show() — an unregistered
        # screen leaves the previous one visible underneath, which is a known bug class here.
        ladder = {"tutorialDone": True, "div": 6, "tours": 3, "money": 250}
        ctx, pg = await open_case(browser, url, ladder, [], errs)
        try:
            await pg.click("#setBtn")
            await pg.wait_for_selector("#settings:not(.hide)")
            check("debug: the shortcut is invisible until the gesture",
                  await pg.locator("#debugBtn").is_hidden(), "")
            pg.on("dialog", lambda d: asyncio.ensure_future(d.accept("developer_debug!")))
            # SCROLL IT INTO VIEW FIRST. #verLine is the LAST element of a screen that
            # overflows (scrollHeight 749 against a 720 viewport), so its centre sits at
            # y=711 with nine pixels to spare. bounding_box() does not scroll, and a few
            # pixels of font-metric difference between Chromium builds is enough to push
            # that centre past the fold: mouse.move then aims outside the viewport, the
            # pointerdown never reaches the build number, and the whole gesture silently
            # does nothing. That is exactly how this passed locally and failed on CI.
            await pg.locator("#verLine").scroll_into_view_if_needed()
            box = await pg.locator("#verLine").bounding_box()
            cy = box["y"] + box["height"] / 2
            vh = await pg.evaluate("innerHeight")
            check("debug: the build number is reachable by pointer",
                  0 <= cy <= vh, "centre y %.0f in a %d viewport" % (cy, vh))
            await pg.mouse.move(box["x"] + box["width"] / 2, cy)
            await pg.mouse.down()
            await pg.wait_for_timeout(5600)
            await pg.mouse.up()
            await pg.wait_for_timeout(400)
            check("debug: holding the build number and answering reveals it",
                  await pg.locator("#debugBtn").is_visible(), "")
            await pg.click("#debugBtn")
            await pg.wait_for_selector("#debug:not(.hide)")
            leaked = await pg.evaluate(
                "['menu','settings','routes','build'].filter(id =>"
                " !document.getElementById(id).classList.contains('hide'))")
            check("debug: the screen is registered, nothing shows underneath",
                  not leaked, "still visible: %r" % (leaked,))
            rows = await pg.evaluate("document.querySelectorAll('#dbgState .note').length")
            check("debug: the panel dumps the save state", rows >= 12, "%d rows" % rows)
            await pg.locator("#dbgGive button", has_text="10,000").click()
            await pg.wait_for_timeout(200)
            money = await pg.evaluate(
                "window.storage.get('slipstream:ladder').then(r => JSON.parse(r.value).money)")
            check("debug: +10,000 lands in the save", money == 10250, "money %r" % money)
            await pg.locator("#dbgDivs button", has_text="1").first.click()
            await pg.wait_for_timeout(200)
            div = await pg.evaluate(
                "window.storage.get('slipstream:ladder').then(r => JSON.parse(r.value).div)")
            check("debug: jumping division rewrites the save", div == 1, "div %r" % div)
        finally:
            await ctx.close()

        # ---- 4c. real roads, free and paid -----------------------------------
        # Kevin: "seeing real routes throughout the game is more exciting than unnamed
        # routes." Free roads are always owned and come from ranges no pack claims, so the
        # free tier can never cannibalise what the packs sell. Everything downstream reads
        # ownedRoutes(), which is the point: renderPractice used to hand-roll its own pack
        # check and so knew nothing about free roads.
        ladder = {"tutorialDone": True, "div": 6, "tours": 3, "money": 20000}
        ctx, pg = await open_case(browser, url, ladder, [], errs)
        try:
            await pg.click("#pracBtn")
            await pg.wait_for_selector("#practice:not(.hide)")
            free_roads = await pg.evaluate(
                "[...document.querySelectorAll('#pRoutes button')].map(b => b.textContent)")
            check("a rider who owns no pack still has real named roads",
                  len(free_roads) >= 4, "practice roads %r" % (free_roads,))
            check("the free roads are real climbs, not invented ones",
                  all(any(w in r for w in ("Col", "Ballon", "Puy", "Mont")) for r in free_roads),
                  "practice roads %r" % (free_roads,))
            await pg.click("#pBack")
            await pg.wait_for_selector("#menu:not(.hide)")
            await pg.click("#routesBtn")
            await pg.wait_for_selector("#routes:not(.hide)")
            packs = await pg.evaluate(
                "[...document.querySelectorAll('#routesBody .card')].map(c => ({"
                " name: c.querySelector('b').textContent,"
                " tag: c.querySelector('.pips').textContent,"
                " btn: c.querySelector('.btns button').textContent,"
                " disabled: c.querySelector('.btns button').disabled }))")
            sellable = [p for p in packs if not p["disabled"]]
            check("a pack on sale always has roads in it",
                  sellable and all(("climb" in p["tag"] or "sector" in p["tag"]) for p in sellable),
                  "sellable %r" % ([(p["name"], p["tag"]) for p in sellable],))
            empty = [p for p in packs if "in the works" in p["tag"]]
            check("a pack with no roads cannot be bought",
                  all(p["disabled"] for p in empty),
                  "empty packs %r" % ([(p["name"], p["btn"], p["disabled"]) for p in empty],))
            check("the Pyrenees pack is no longer an empty box",
                  any(p["name"] == "The Pyrenees" and "climb" in p["tag"] for p in packs),
                  "packs %r" % ([(p["name"], p["tag"]) for p in packs],))
            check("every advertised pack now has roads, including the cobbles",
                  not empty and len(sellable) == 3,
                  "packs %r" % ([(p["name"], p["tag"]) for p in packs],))
            # A sector has no gradient and no summit, so listing it like a climb prints
            # "at undefined%". It is rated in stars, the way pave actually is.
            roads = await pg.evaluate(
                "[...document.querySelectorAll('#routesBody .card .note')].map(n => n.textContent)")
            cobble_lines = [r for r in roads if "pave" in r]
            check("a cobbled sector is described as pave, not as a climb",
                  cobble_lines and all("undefined" not in r and "%" not in r
                                       for r in cobble_lines),
                  "sector lines %r" % (cobble_lines,))
        finally:
            await ctx.close()

        # Every stage is titled from somewhere to somewhere, and the title is derived from
        # the seed so the daily's shared board stays fair.
        async def brief_title(lad, race_name):
            ctx, pg = await open_case(browser, url, lad, [], errs, rand_seed=99)
            try:
                await pg.click("#startBtn")
                await pg.wait_for_selector("#pick:not(.hide)")
                await pg.locator("#pickBody .card", has_text=race_name).locator(
                    "button.mini").click()
                await pg.wait_for_selector("#build:not(.hide)")
                await pg.click("#bLock")
                await pg.wait_for_selector("#brief:not(.hide)")
                return (await pg.locator("#bTitle").text_content()).strip()
            finally:
                await ctx.close()

        base = {"tutorialDone": True, "div": 6, "tours": 3, "money": 100}
        t1 = await brief_title(base, "Three-day tour")
        check("a stage is titled from a town to a town",
              "→" in t1 and len(t1) > 6, "title %r" % (t1,))
        t2 = await brief_title(base, "Three-day tour")
        check("the same seed titles the same stage the same way", t1 == t2,
              "%r vs %r" % (t1, t2))

        # ---- 5c. the body UI must SAY why you cannot change it ---------------
        # Kevin: "it seems like a bug that you can't change anything. It needs to be
        # designed better so people know they need to unlock it first." The physique rows
        # were a segmented control whose whole explanation lived in `title` — a TOOLTIP,
        # which a touch screen never shows. They are CARDS now, the same as the bike parts,
        # so the requirement and the price are ordinary words on the card. Asserted on
        # rendered text only, never on an attribute.
        async def phys_cards(lad, group=None):
            ctx, pg = await open_case(browser, url, lad, [], errs)
            try:
                await pg.click("#buildBtn")
                await pg.locator("#build").wait_for(state="visible")
                if group:
                    await pg.locator("#bPhysique .segmented button", has_text=group).click()
                    await pg.wait_for_timeout(150)
                return pg, ctx, await pg.evaluate(
                    "[...document.querySelectorAll('#bPhysique .strip .card')].map(c => ({"
                    " name: c.querySelector('b').textContent,"
                    " tag: c.querySelector('.pips') ? c.querySelector('.pips').textContent : '',"
                    " fx: c.querySelector('.fx') ? c.querySelector('.fx').innerText : '',"
                    " btn: c.querySelector('.btns button') ? c.querySelector('.btns button').textContent : '',"
                    " disabled: c.querySelector('.btns button') ? c.querySelector('.btns button').disabled : None_,"
                    " cls: c.className }))".replace("None_", "null"))
            except Exception:
                await ctx.close()
                raise

        lad = {"tutorialDone": True, "div": 6, "tours": 2, "money": 0,
               "career": {"climb": 0, "sprint": 0, "endur": 0, "durab": 0}}
        pg, ctx, cards = await phys_cards(lad)
        try:
            check("physique renders as cards, like the bike parts",
                  len(cards) == 5 and all(c["name"] for c in cards),
                  "cards %r" % ([c["name"] for c in cards],))
            locked = [c for c in cards if "locked" in (c["cls"] or "")]
            # innerText comes back uppercased: `.card .fx .lead` is text-transform:uppercase,
            # the same treatment a part's "Unlocks at Division 3" gets. Compare case-blind.
            check("physique: a locked option is tagged and SAYS what it needs, in words",
                  locked and all(c["tag"] == "locked" for c in locked)
                  and all("reach" in c["fx"].lower() and "by racing" in c["fx"].lower()
                          for c in locked),
                  "locked %r" % ([(c["name"], c["tag"], c["fx"]) for c in locked],))
            check("physique: the free neutral is wearable with no price",
                  any(c["tag"] == "worn" and not c["fx"] for c in cards),
                  "cards %r" % ([(c["name"], c["tag"], c["btn"]) for c in cards],))
        finally:
            await ctx.close()

        # For sale, and never a dead button: unaffordable states the price and still answers.
        lad = {"tutorialDone": True, "div": 4, "tours": 6, "money": 900,
               "career": {"climb": 40, "sprint": 40, "endur": 40, "durab": 20}}
        pg, ctx, cards = await phys_cards(lad)
        try:
            sale = [c for c in cards if c["tag"] == "for sale"]
            check("physique: an unlocked-but-unbought option is for sale with a price",
                  sale and all(("Buy" in c["btn"]) or ("prize money" in c["btn"]) for c in sale),
                  "for sale %r" % ([(c["name"], c["btn"]) for c in sale],))
            check("physique: no buy button is disabled and inert",
                  not any(c["disabled"] for c in cards),
                  "disabled %r" % ([c["name"] for c in cards if c["disabled"]],))
            money_before = await pg.evaluate(
                "window.storage.get('slipstream:ladder').then(r => JSON.parse(r.value).money)")
            await pg.locator("#bPhysique .strip .card", has_text="Lean").locator(
                ".btns button").first.click()
            await pg.wait_for_timeout(250)
            after = await pg.evaluate(
                "window.storage.get('slipstream:ladder').then(r => JSON.parse(r.value))")
            check("physique: buying spends and wears it",
                  after["money"] < money_before and after.get("weight") == "lean",
                  "money %r -> %r, weight %r" % (money_before, after["money"], after.get("weight")))
        finally:
            await ctx.close()

        # A training block that no longer fits the budget was rendered "No room" AND
        # disabled, while the only code that removes an id from ladder.training is that
        # button's own click handler. Drop a division and a block was stuck in the save.
        ladder = {"tutorialDone": True, "div": 8, "tours": 6, "money": 5000,
                  "career": {"climb": 90, "sprint": 90, "endur": 90, "durab": 90},
                  # trainOwned reads `trainOwned`; `training` is only what you CARRY. All
                  # four are in seeded dimensions so they are genuinely earned and bought,
                  # and three 3-pointers exhaust a Division 8 budget, so `gut` overflows —
                  # which used to render "No room", disabled, unremovable forever.
                  "trainOwned": ["altitude", "leadout", "gtblock", "gut"],
                  "training": ["altitude", "leadout", "gtblock", "gut"]}
        ctx, pg = await open_case(browser, url, ladder, [], errs)
        try:
            await pg.click("#buildBtn")
            await pg.locator("#build").wait_for(state="visible")
            cards = await pg.evaluate(
                "[...document.querySelectorAll('#bTraining .card')].map(c => ({"
                " name: c.querySelector('b') ? c.querySelector('b').textContent : '',"
                " text: c.querySelector('.btns button') ? c.querySelector('.btns button').textContent : '',"
                " disabled: c.querySelector('.btns button') ? c.querySelector('.btns button').disabled : null }))")
            check("training: no button is ever disabled and inert",
                  cards and not any(c["disabled"] for c in cards),
                  "disabled: %r" % ([c["name"] for c in cards if c["disabled"]],))
            over = [c for c in cards if "drop" in (c["text"] or "")]
            check("training: an over-budget block offers to be dropped",
                  bool(over), "buttons %r" % ([c["text"] for c in cards][:8],))
            if over:
                saved_before = await pg.evaluate(
                    "window.storage.get('slipstream:ladder').then(r => JSON.parse(r.value).training)")
                await pg.locator("#bTraining .card", has_text=over[0]["name"]).locator(
                    ".btns button").first.click()
                await pg.wait_for_timeout(200)
                saved_after = await pg.evaluate(
                    "window.storage.get('slipstream:ladder').then(r => JSON.parse(r.value).training)")
                check("training: dropping it actually clears it from the save",
                      len(saved_after or []) < len(saved_before or []),
                      "%r -> %r" % (saved_before, saved_after))
        finally:
            await ctx.close()

        # ---- 6. earned, then bought: parts, physique and training ------------
        # Racing UNLOCKS, prize money BUYS, and money can never skip the unlock. Neutral
        # options stay free so a rider who has bought nothing is still legal.
        ladder = {"tutorialDone": True, "div": 3, "tours": 9, "wins": 5, "money": 6000,
                  "career": {"climb": 95, "sprint": 40, "endur": 60, "durab": 50,
                             "aero": 30, "handle": 55},
                  "parts": [], "physique": [], "trainOwned": [], "training": []}
        ctx, pg = await open_case(browser, url, ladder, [], errs)
        await pg.click("#buildBtn")
        await pg.locator("#build").wait_for(state="visible")

        async def saved(key):
            return await pg.evaluate(
                "window.storage.get('slipstream:ladder').then(r => JSON.parse(r.value)['%s'])" % key)

        await pg.locator("#bSlots button", has_text="Wheels").click()
        await pg.wait_for_timeout(150)
        disc = pg.locator("#bList .card", has_text="Deep / disc")
        label = await disc.locator(".btns button").text_content()
        check("part for sale before it is bought", "Buy" in label,
              "an unlocked-but-unbought part offers a price: %r" % label)
        await disc.locator(".btns button").click()
        await pg.wait_for_timeout(200)
        check("buying a part spends prize money", await saved("money") == 5000,
              "6000 - 1000 = %r" % (await saved("money"),))
        check("bought part is owned and fitted", await saved("parts") == ["disc"],
              "owned parts %r" % (await saved("parts"),))

        # Physique is cards now, same as the bike parts: one deliberate press on the card's
        # own Buy button, no arming step needed.
        await pg.locator("#bPhysique .strip .card", has_text="Featherweight").locator(
            ".btns button").first.click()
        await pg.wait_for_timeout(250)
        check("buying physique spends and is worn",
              await saved("money") == 2600 and await saved("weight") == "feather",
              "money %r, weight %r" % (await saved("money"), await saved("weight")))

        hills = pg.locator("#bTraining .card", has_text="Hill repeats")
        await hills.locator(".btns button").click()
        await pg.wait_for_timeout(200)
        check("buying training spends prize money", await saved("money") == 1900,
              "2600 - 700 = %r" % (await saved("money"),))
        after = await hills.locator(".btns button").text_content()
        check("a bought block can then be carried", after == "Carry",
              "button reads %r once owned" % after)
        await ctx.close()

        # ---- 7. a rider who owns NOTHING is still legal ----------------------
        # The neutral rule. Every layer keeps a free option, so being broke never leaves
        # you unable to field a complete bike.
        ladder = {"tutorialDone": True, "div": 3, "tours": 2, "money": 0,
                  "career": {"climb": 95, "sprint": 40, "endur": 60, "durab": 50,
                             "aero": 30, "handle": 55},
                  "parts": [], "physique": [], "trainOwned": [], "training": [],
                  "build": {"frame": "carbon", "wheels": "disc", "gearing": "big",
                            "position": "slammed", "tires": "grip"}}
        ctx, pg = await open_case(browser, url, ladder, [], errs)
        await pg.click("#buildBtn")
        await pg.locator("#build").wait_for(state="visible")
        arche = await pg.text_content("#bArche")
        check("a broke rider still has a complete bike", "reads as a" in arche,
              "build screen describes a bike: %r" % arche)
        await pg.click("#bLock")
        await pg.wait_for_timeout(250)
        b = await pg.evaluate(
            "window.storage.get('slipstream:ladder').then(r => JSON.parse(r.value).build)")
        unpaid = [v for v in (b or {}).values() if v in ("disc", "big", "slammed", "grip", "carbon")]
        check("an unowned part cannot be locked into a build", not unpaid,
              "saved build fell back to owned parts: %r" % (b,))
        await ctx.close()

        # ---- 2. route pack pricing ladder: BY COUNT OWNED, not by pack ------
        # alps (the only pack with climbs, so the only card that can show a
        # price) stays unowned; other ids fill the owned list. Its displayed
        # price must follow 3000 / 6000 / 12000 / capped 18000.
        cases = [
            ([], 3000, True),
            (["cobbles"], 6000, True),
            (["cobbles", "pyrenees"], 12000, True),
            # a third non-alps id stands in for a future pack: 3000 * 2^3
            # would be 24000, the cap must hold it at 18000, and with every
            # catalogued pack counted as owned the "next costs" paragraph is
            # gone, so the card button is where the cap must show
            (["cobbles", "pyrenees", "future"], 18000, False),
        ]
        for packs, want, want_para in cases:
            ladder = {"tutorialDone": True, "tours": 1, "money": 1234,
                      "packs": packs}
            ctx, pg = await open_case(browser, url, ladder, [], errs)
            r = await read_routes(pg)
            got_btn = btn_price(r["btnText"])
            got_para = para_price(r["priceLine"])
            name = "pack price with %d owned%s" % (len(packs),
                                                   " (cap)" if want == 18000 else "")
            if want_para:
                check(name, got_btn == want and got_para == want,
                      "want %d, card button %s, paragraph %s"
                      % (want, got_btn, got_para))
            else:
                check(name, got_btn == want and r["priceLine"] is None,
                      "want %d on the card and no next-costs paragraph; button %s, paragraph %r"
                      % (want, got_btn, r["priceLine"]))
            await ctx.close()

        # ---- 3b. rival information belongs to the race radio -----------------
        # Where the leader is, how far clear you are and where every rider off the
        # top of the screen sits used to be free and permanently on screen. They are
        # the radio's now, tiered: I hears the race, II gets the numbers, III sees
        # the road ahead. Each case starts a race, rides a few seconds and reads what
        # the HUD decided; no case runs to the line, because the gate is decided on
        # the first frame.
        async def hud_after_start(lad_seed):
            ctx, pg = await open_case(browser, url, lad_seed, [], errs, rand_seed=42)
            try:
                await pg.click("#startBtn")
                await pg.wait_for_selector("#pick:not(.hide)")
                await pg.locator("#pickBody .card").first.locator("button.mini").click()
                await pg.wait_for_selector("#build:not(.hide)")
                await pg.click("#bLock")
                await pg.wait_for_selector("#brief:not(.hide)")
                await pg.click("#rollBtn")
                side = 0
                for _ in range(22):                     # ~7s of racing, past the roll-out
                    await pg.keyboard.press("z" if side == 0 else "x")
                    side ^= 1
                    await pg.wait_for_timeout(320)
                return await pg.evaluate("window.__hud || null")
            finally:
                await ctx.close()

        base = {"tutorialDone": True, "div": 8, "tours": 1, "money": 500}
        h = await hud_after_start(dict(base, tactics=["powerMeter"], wins=12))
        check("no radio: no rival information at all",
              h is not None and h.get("radio", 0) == 0
              and not h.get("leader") and h.get("pipGate") == 0 and h.get("pips", 0) == 0
              and h.get("stripGate") == 0 and h.get("strip", 0) == 0,
              "hud reported %r" % (h,))

        h = await hud_after_start(dict(base, tactics=["radio"], wins=0))
        check("radio I: hears the race, sees no positions anywhere",
              h is not None and h.get("radio", 0) == 1
              and not h.get("leader") and h.get("pipGate") == 0 and h.get("pips", 0) == 0
              and h.get("stripGate") == 0 and h.get("strip", 0) == 0,
              "hud reported %r" % (h,))

        # Radio II is the level that opens the SHAPE of the race: the leader gap, and the
        # rivals on the profile strip. The rail (exact metres) is still III.
        h = await hud_after_start(dict(base, tactics=["radio"], wins=5))
        check("radio II: the strip shows rivals, the rail stays shut",
              h is not None and h.get("radio", 0) == 2 and h.get("leader") == 1
              and h.get("stripGate") == 1 and h.get("strip", 0) > 0
              and h.get("pipGate") == 0 and h.get("pips", 0) == 0,
              "hud reported %r" % (h,))

        h = await hud_after_start(dict(base, tactics=["radio"], wins=12))
        check("radio III: leader gap, the strip and the rider rail all open",
              h is not None and h.get("radio", 0) == 3
              and h.get("leader") == 1 and h.get("pipGate") == 1
              and h.get("stripGate") == 1 and h.get("strip", 0) > 0,
              "hud reported %r" % (h,))

        # ---- 4. result recording: one shrunk one-day race -------------------
        # seeded with the medium credit already held, so at Division 8 (top
        # three required, short + medium only) a top-3 here promotes; either
        # branch of the placing rule is asserted, neither is flaky
        ladder = {"tutorialDone": True, "div": 8, "tours": 1, "money": 500,
                  "req": {"medium": True}}
        ctx, pg = await open_case(browser, url, ladder, [], errs, rand_seed=42)
        await pg.click("#startBtn")
        await pg.wait_for_selector("#pick:not(.hide)")
        await pg.locator("#pickBody .card").first.locator("button.mini").click()
        await pg.wait_for_selector("#build:not(.hide)")
        await pg.click("#bLock")
        await pg.wait_for_selector("#brief:not(.hide)")
        await pg.click("#rollBtn")

        # pedal: alternate z / x at ~2.8 strokes/s, just under the attack
        # threshold, and never 3 strokes inside 0.6s (that commits a jump)
        finished = False
        deadline = time.monotonic() + 110
        side = 0
        while time.monotonic() < deadline:
            await pg.keyboard.press("z" if side == 0 else "x")
            side ^= 1
            await pg.wait_for_timeout(320)
            if await pg.evaluate(
                    "!document.getElementById('result').classList.contains('hide')"):
                finished = True
                break
        check("race completes", finished,
              "shrunk one-day race reached the result screen"
              if finished else "no result screen within 110s")

        lad = hist = None
        if finished:
            saved = await pg.evaluate("""() => ({
              l: window.__slipTestStore.getItem('slipstream:ladder'),
              h: window.__slipTestStore.getItem('slipstream:history') })""")
            lad = json.loads(saved["l"]) if saved["l"] else None
            hist = json.loads(saved["h"]) if saved["h"] else None

            await pg.click("#dataBtnRes")
            await pg.wait_for_selector("#data:not(.hide)")
            dsub = await pg.text_content("#dataSub")
            check("result recorded in palmares", dsub == "1 race on record",
                  "seeded 0 races, palmares shows %r" % dsub)
            check("result recorded in save history",
                  isinstance(hist, list) and len(hist) == 1,
                  "saved history has %s entries"
                  % (len(hist) if isinstance(hist, list) else "no"))
            check("race counted in ladder.tours",
                  bool(lad) and lad.get("tours") == 2,
                  "seeded 1, saved %s" % (lad.get("tours") if lad else None))

            place = hist[0].get("place") if hist else None
            req = (lad or {}).get("req") or {}
            if place is not None and place <= 3:
                ok = lad.get("div") == 7 and req == {}
                detail = ("top three with the medium credit held promotes: "
                          "saved div %s, req %r" % (lad.get("div"), req))
            else:
                ok = (lad.get("div") == 8 and req.get("medium") is True
                      and not req.get("short"))
                detail = ("outside the top three holds Division 8 and keeps "
                          "the medium credit: saved div %s, req %r"
                          % (lad.get("div"), req))
            check("placing rule consistency", ok, detail)
            print("note placing this run: %s" % place, flush=True)
        else:
            check("result recorded in palmares", False, "race never finished")
            check("result recorded in save history", False, "race never finished")
            check("race counted in ladder.tours", False, "race never finished")
            check("placing rule consistency", False, "race never finished")
        await ctx.close()

        await browser.close()

    check("no page errors across all cases", not errs, "; ".join(errs[:3]))
    print("note elapsed: %.1fs" % (time.monotonic() - t0), flush=True)
    ok = all(RESULTS)
    print("CAREER: " + ("PASS (%d checks)" % len(RESULTS) if ok else "FAIL"),
          flush=True)
    sys.exit(0 if ok else 1)


asyncio.run(main())
