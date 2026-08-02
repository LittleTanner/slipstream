import asyncio
import pathlib
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page()
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto((pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri())
        await pg.wait_for_timeout(1500)
        print("page errors:", errs or "none")
        await b.close()
asyncio.run(main())
