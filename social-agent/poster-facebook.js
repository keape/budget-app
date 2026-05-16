import { notify } from './notify.js';

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

export async function postToFacebook(postFacebook, dryRun = false) {
  if (dryRun) {
    console.log('[Facebook dry-run]', postFacebook.slice(0, 120) + '…');
    return;
  }

  const { FACEBOOK_PAGE_TOKEN, FACEBOOK_GROUP_ID } = process.env;
  if (!FACEBOOK_PAGE_TOKEN || !FACEBOOK_GROUP_ID) {
    throw new Error('Missing Facebook credentials. Set FACEBOOK_PAGE_TOKEN and FACEBOOK_GROUP_ID.');
  }

  try {
    const res = await fetch(`${GRAPH_BASE}/${FACEBOOK_GROUP_ID}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: postFacebook, access_token: FACEBOOK_PAGE_TOKEN }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `HTTP ${res.status}`);
    }

    console.log(`[Facebook] Posted: ${data.id}`);
    const preview = postFacebook.slice(0, 80) + '…';
    await notify(`Posted on Facebook: ${preview}`, 'Budget365 — Facebook');
  } catch (err) {
    console.error(`[Facebook] Post failed: ${err.message}`);
    await notify(`Facebook post FAILED: ${err.message}`, 'Budget365 — Facebook Error');
    throw err;
  }
}
