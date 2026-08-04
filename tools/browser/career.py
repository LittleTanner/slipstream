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
        ("  gap = leader === you ? 0 : leader.dist - you.dist;\n"
         "  if ((you.stats.radio || 0) >= 2) {",
         "  gap = leader === you ? 0 : leader.dist - you.dist;\n"
         "  (window.__hud = window.__hud || { pips: 0 }).radio = (you.stats.radio || 0);\n"
         "  if ((you.stats.radio || 0) >= 2) { window.__hud.leader = 1;"),
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

        # ---- 5. race craft is a CHOICE, not a win-count drip -----------------
        # Both items used to arrive automatically on career wins, so the build was
        # choiceless. Fitting decides whether you carry it; the career decides how
        # good it is. The limit is 1 while the pool is 2, so carrying one must
        # DROP the other, which is the whole point.
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
        check("race craft: seeded fit shows as carried",
              st.get("Race radio") == "Carrying" and st.get("Power meter") == "Carry this",
              "seeded radio, cards read %r" % st)
        await pg.locator("#bTactics .card", has_text="Power meter").locator(".btns button").click()
        await pg.wait_for_timeout(150)
        st = await craft()
        check("race craft: carrying one drops the other",
              st.get("Power meter") == "Carrying" and st.get("Race radio") == "Carry this",
              "after carrying the power meter, cards read %r" % st)
        saved = await pg.evaluate(
            "window.storage.get('slipstream:ladder').then(r => r ? JSON.parse(r.value).tactics : null)")
        check("race craft: the choice persists", saved == ["powerMeter"],
              "saved tactics %r" % (saved,))
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

        await pg.locator("#bPhysique .segmented").first.locator(
            "button", has_text="Featherweight").click()
        await pg.wait_for_timeout(200)
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
              and not h.get("leader") and h.get("pipGate") == 0 and h.get("pips", 0) == 0,
              "hud reported %r" % (h,))

        h = await hud_after_start(dict(base, tactics=["radio"], wins=0))
        check("radio I: hears the race, sees no numbers",
              h is not None and h.get("radio", 0) == 1
              and not h.get("leader") and h.get("pipGate") == 0 and h.get("pips", 0) == 0,
              "hud reported %r" % (h,))

        h = await hud_after_start(dict(base, tactics=["radio"], wins=12))
        check("radio III: leader gap and the rider rail both open",
              h is not None and h.get("radio", 0) == 3
              and h.get("leader") == 1 and h.get("pipGate") == 1,
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
