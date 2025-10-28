import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Get the absolute path to the index.html file
        html_file_path = os.path.abspath('index.html')

        await page.goto(f'file://{html_file_path}')

        # Wait for the menu grid to have at least one card
        await page.wait_for_selector('#menuGrid .card', timeout=5000)

        # Take a screenshot of the menu grid
        await page.locator('#menuGrid').screenshot(path='jules-scratch/verification/menu_cards.png')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
