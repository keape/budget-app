#!/usr/bin/env node
/**
 * Reads x.com cookies from your real Chrome profile (already logged in)
 * and saves them to .x-session.json for the social agent.
 *
 * Requirements: be logged in to x.com in Chrome, and Chrome must be CLOSED.
 */
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const chromeCookies = require('chrome-cookies-secure');
const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIES_FILE = join(__dirname, '.x-session.json');

console.log('Reading x.com cookies from Chrome...');
console.log('(Chrome must be closed for the cookie DB to be readable)\n');

chromeCookies.getCookies('https://x.com', 'puppeteer', (err, cookies) => {
  if (err) {
    console.error('Error:', err.message);
    console.error('\nMake sure Chrome is fully closed and try again.');
    process.exit(1);
  }

  if (!cookies || cookies.length === 0) {
    console.error('No cookies found for x.com.');
    console.error('Make sure you are logged in to x.com in Chrome first.');
    process.exit(1);
  }

  // Normalize field names for Playwright addCookies compatibility
  const normalized = cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    expires: c.expires,
    secure: c.Secure || c.secure || false,
    httpOnly: c.HttpOnly || c.httpOnly || false,
    sameSite: c.SameSite || c.sameSite || 'Lax',
  }));

  writeFileSync(COOKIES_FILE, JSON.stringify(normalized, null, 2));
  console.log(`Saved ${normalized.length} cookies to .x-session.json`);
  console.log('Done! Run the agent normally now.');
});
