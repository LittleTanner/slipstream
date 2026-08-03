import asyncio
import os
import pathlib
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        # Same chromium resolution as tools/browser/*: PW_CHROMIUM overrides, the
        # /opt/pw-browsers symlink is the sandbox default, else playwright's own.
        exe = os.environ.get("PW_CHROMIUM")
        if not exe and os.path.exists("/opt/pw-browsers/chromium"):
            exe = "/opt/pw-browsers/chromium"
        b = await (p.chromium.launch(executable_path=exe) if exe else p.chromium.launch())
        pg=await b.new_page()
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto((pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri())
        await pg.wait_for_timeout(1500)
        print("page errors:", errs or "none")
        await b.close()
        if errs:
            raise SystemExit(1)
asyncio.run(main())
