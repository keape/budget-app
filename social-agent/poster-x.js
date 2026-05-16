import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { notify } from './notify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIES_FILE = join(__dirname, '.x-session.json');

async function composeTweet(page, text) {
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });

  // Dismiss cookie consent banner if present
  const acceptBtn = page.locator('text=Accept all cookies');
  if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acceptBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click compose area in feed (more reliable than sidebar button)
  const feedCompose = page.locator('[data-testid="tweetTextarea_0"]').first();
  await feedCompose.waitFor({ timeout: 15000 });
  await feedCompose.click();
  await feedCompose.fill(text);

  const tweetBtn = page.locator('[data-testid="tweetButtonInline"]').first();
  await tweetBtn.waitFor({ timeout: 5000 });
  await tweetBtn.click();

  await page.waitForTimeout(2000);
}

async function composeThread(page, posts) {
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });

  const composeBtn = page.locator('[data-testid="SideNav_NewTweet_Button"]');
  await composeBtn.waitFor({ timeout: 10000 });
  await composeBtn.click();

  for (let i = 0; i < posts.length; i++) {
    const textarea = page.locator('[data-testid="tweetTextarea_0"]').nth(i);
    await textarea.waitFor({ timeout: 8000 });
    await textarea.fill(posts[i]);

    if (i < posts.length - 1) {
      const addBtn = page.locator('[data-testid="addButton"]');
      await addBtn.waitFor({ timeout: 5000 });
      await addBtn.click();
    }
  }

  const tweetBtn = page.locator('[data-testid="tweetButtonInline"]');
  await tweetBtn.waitFor({ timeout: 5000 });
  await tweetBtn.click();
  await page.waitForTimeout(2000);
}

export async function postToX({ postX, threadX }, dryRun = false) {
  if (dryRun) {
    console.log('[X dry-run]', postX);
    if (threadX?.length) threadX.forEach((t, i) => console.log(`[X thread ${i + 1}]`, t));
    return;
  }

  if (!existsSync(COOKIES_FILE)) {
    throw new Error('No X session found. Run: node login-x.js');
  }

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  try {
    const cookies = JSON.parse(readFileSync(COOKIES_FILE, 'utf8'));
    await context.addCookies(cookies);

    const page = await context.newPage();
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });

    // Dismiss cookie consent banner if present
    const acceptCookiesBtn = page.locator('text=Accept all cookies');
    if (await acceptCookiesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptCookiesBtn.click();
      await page.waitForTimeout(1000);
    }

    // If redirected to login page, session is expired
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/i/flow')) {
      throw new Error('X session expired. Run: node login-x.js');
    }

    const posts = threadX?.length ? [postX, ...threadX] : null;
    if (posts) {
      await composeThread(page, posts);
    } else {
      await composeTweet(page, postX);
    }

    console.log('[X] Posted successfully');
    const preview = postX.length > 80 ? postX.slice(0, 80) + '...' : postX;
    await notify(`Posted on X: ${preview}`, 'Budget365 X');
  } catch (err) {
    console.error(`[X] Post failed: ${err.message}`);
    try {
      const page = (await context.pages())[0];
      if (page) await page.screenshot({ path: join(__dirname, 'x-error.png') });
    } catch {}
    await notify(`X post FAILED: ${err.message}`, 'Budget365 X Error');
    throw err;
  } finally {
    await browser.close();
  }
}
