#!/usr/bin/env python3
"""Debug script to see what's actually rendered"""

from playwright.sync_api import sync_playwright
import time

FRONTEND_URL = "http://localhost:3000"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 375, "height": 667})
    page = context.new_page()
    
    print("Loading app...")
    page.goto(FRONTEND_URL, wait_until="networkidle", timeout=30000)
    
    print("\nWaiting 5 seconds for app to fully load...")
    time.sleep(5)
    
    print("\nCurrent URL:", page.url)
    
    print("\nPage title:", page.title())
    
    print("\nVisible text on page:")
    body_text = page.locator("body").inner_text()
    print(body_text[:1000])
    
    print("\nTaking screenshot...")
    page.screenshot(path="/app/debug_screenshot.png")
    print("Screenshot saved to /app/debug_screenshot.png")
    
    browser.close()
