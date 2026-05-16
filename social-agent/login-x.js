#!/usr/bin/env node
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIES_FILE = join(__dirname, '.x-session.json');

process.stdout.write('=== X Login Helper ===\n');
process.stdout.write('Opening browser...\n');

let browser;
try {
  browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  process.stdout.write('Chrome opened.\n');
} catch (e) {
  process.stdout.write(`Chrome not found (${e.message.slice(0, 60)}), using Chromium...\n`);
  browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  process.stdout.write('Chromium opened.\n');
}

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 800 },
});

const page = await context.newPage();
process.stdout.write('Navigating to x.com/login...\n');
await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded' });

process.stdout.write('\n--- Log in to X in the browser window ---\n');
process.stdout.write('The script will auto-save and close when login is detected.\n\n');

// Auto-detect login: wait up to 3 minutes for home feed
await page.waitForURL(url => url.includes('x.com/home') || url.includes('twitter.com/home'), { timeout: 180000 });
// Wait for the compose button to confirm full load
await page.locator('[data-testid="SideNav_NewTweet_Button"]').waitFor({ timeout: 30000 });

const cookies = await context.cookies();
writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
process.stdout.write(`Session saved: ${cookies.length} cookies → .x-session.json\n`);
process.stdout.write('Done. The agent will use this session automatically.\n');

await browser.close();
process.exit(0);
