import 'dotenv/config';
import cron from 'node-cron';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gatherContext } from './context.js';
import { generatePost } from './generator.js';
import { postToX } from './poster-x.js';
import { postToFacebook } from './poster-facebook.js';
import { notify } from './notify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REDDIT_DRAFTS_DIR = join(__dirname, 'reddit-drafts');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const platformFlag = args.find(a => a.startsWith('--platform='))?.split('=')[1];
const typeFlag = args.find(a => a.startsWith('--type='))?.split('=')[1];

mkdirSync(REDDIT_DRAFTS_DIR, { recursive: true });

function saveRedditDraft(generated, postType) {
  const date = new Date().toISOString().split('T')[0];
  const subreddit = generated.redditSubreddit || 'sideprojects';
  const filename = `${date}-${subreddit}-${postType}.md`;
  const path = join(REDDIT_DRAFTS_DIR, filename);

  const content = [
    `# Subreddit: r/${subreddit}`,
    `# Post type: ${postType}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Title: ${generated.redditTitle}`,
    '',
    '---',
    '',
    generated.redditBody,
  ].join('\n');

  writeFileSync(path, content, 'utf8');
  console.log(`[reddit] Draft saved: ${filename}`);
}

async function run(postType) {
  console.log(`\n[agent] Running post type: ${postType} | dry-run: ${isDryRun}`);

  let context, generated;
  try {
    context = await gatherContext();
    generated = await generatePost(context, postType);
  } catch (err) {
    console.error(`[agent] Generation failed: ${err.message}`);
    await notify(`Content generation FAILED: ${err.message}`, 'Budget365 Agent Error');
    return;
  }

  const errors = [];

  if (!platformFlag || platformFlag === 'x') {
    try {
      await postToX({ postX: generated.postX, threadX: generated.threadX }, isDryRun);
    } catch (err) {
      errors.push(`X: ${err.message}`);
    }
  }

  if (!platformFlag || platformFlag === 'facebook') {
    try {
      await postToFacebook(generated.postFacebook, isDryRun);
    } catch (err) {
      errors.push(`Facebook: ${err.message}`);
    }
  }

  saveRedditDraft(generated, postType);

  if (errors.length) {
    console.error('[agent] Some platforms failed:', errors.join('; '));
  } else {
    console.log('[agent] Done.');
  }
}

async function checkMilestones() {
  // milestone thresholds — extend as the app grows
  const THRESHOLDS = [100, 500, 1000, 5000, 10000];
  const context = await gatherContext();
  if (!context.userCount) return;

  for (const threshold of THRESHOLDS) {
    if (context.userCount >= threshold && context.userCount < threshold * 1.05) {
      console.log(`[milestones] Hit threshold: ${threshold} users`);
      await run('milestone');
      break;
    }
  }
}

// --- CLI one-shot mode ---
if (typeFlag) {
  run(typeFlag).catch(err => { console.error(err); process.exit(1); });
} else if (args.includes('--check-milestones')) {
  checkMilestones().catch(err => { console.error(err); process.exit(1); });
} else if (isDryRun && !typeFlag) {
  // dry-run without --type: run all types for preview
  (async () => {
    for (const type of ['build_diary', 'finance_tip', 'feature_poll']) {
      await run(type);
    }
  })();
} else {
  // --- Scheduled daemon mode ---
  console.log('[agent] Starting scheduler…');

  // Monday 09:00 — build diary
  cron.schedule('0 9 * * 1', () => run('build_diary'), { timezone: 'Europe/Rome' });
  // Wednesday 09:00 — finance tip
  cron.schedule('0 9 * * 3', () => run('finance_tip'), { timezone: 'Europe/Rome' });
  // Friday 09:00 — feature poll
  cron.schedule('0 9 * * 5', () => run('feature_poll'), { timezone: 'Europe/Rome' });
  // Every day 08:00 — milestone check
  cron.schedule('0 8 * * *', () => checkMilestones(), { timezone: 'Europe/Rome' });

  console.log('[agent] Scheduled: Mon/Wed/Fri 09:00 + daily milestone check (Europe/Rome)');
}
