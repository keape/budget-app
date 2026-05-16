import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5';

const SYSTEM_PROMPT = `You are the social media voice of Budget365, a personal budget + investment tracking app.
The founder (a solo developer) is building this app based on community votes — users decide what gets built next.
App URL: https://budget-app-keape.vercel.app

Tone rules:
- Direct, honest, indie dev voice. The founder speaks, not a brand.
- No corporate language, no buzzwords, no hyperbole.
- No emojis overload — max 1-2 per post, only if natural.
- Hashtags at the end: #buildinpublic #personalfinance #indiehacker #FIRE #budgetapp (use relevant subset).

Output format: always return valid JSON matching the requested structure.`;

function pickRandomTopic() {
  const topics = JSON.parse(readFileSync(join(__dirname, 'topics-bank.json'), 'utf8'));
  return topics[Math.floor(Math.random() * topics.length)];
}

function buildPrompt(context, postType) {
  const base = `
App context:
- Recent commits: ${context.recentCommits.slice(0, 5).join('; ')}
- Week number: ${context.weekNumber}
- User count: ${context.userCount || 'unknown'}
- Pending features (community can vote): ${context.pendingFeatures.map(f => f.label).join(', ')}
- Top voted feature: ${context.topVotedFeature?.label || 'none yet'}
- App URL: ${context.appUrl}
`;

  const prompts = {
    build_diary: `${base}
Write a build diary update for this week. Share what was shipped (based on recent commits), what's coming next, and invite the community to vote on the next feature.

Return JSON: { "postX": "string ≤280 chars", "threadX": ["string", ...] or null, "postFacebook": "string 150-300 words", "redditTitle": "string", "redditBody": "string 200-400 words", "redditSubreddit": "sideprojects" }`,

    finance_tip: `${base}
Write an educational personal finance post based on this topic: ${JSON.stringify(pickRandomTopic())}

Make it genuinely useful and platform-native. Mention Budget365 only if it fits naturally (not forced).

Return JSON: { "postX": "string ≤280 chars", "threadX": ["string", ...] or null (use thread for listicles), "postFacebook": "string 150-300 words", "redditTitle": "string", "redditBody": "string 300-500 words", "redditSubreddit": "personalfinance" }`,

    feature_poll: `${base}
Create a feature poll post asking the community to vote on the next feature to build. Pick the 2 most interesting pending features.
For X, use the native poll format: state the question, then list options as A) and B).
Be transparent about how votes actually influence the roadmap.

Return JSON: { "postX": "string ≤280 chars (include A) and B) options)", "threadX": null, "postFacebook": "string 150-250 words with clear poll options", "redditTitle": "string", "redditBody": "string 200-350 words", "redditSubreddit": "IndieHackers" }`,

    milestone: `${base}
Write a milestone celebration post. User count: ${context.userCount}.
Be honest and grounded — don't oversell. Share what you've learned from users so far.

Return JSON: { "postX": "string ≤280 chars", "threadX": ["string", ...] or null, "postFacebook": "string 150-300 words", "redditTitle": "string", "redditBody": "string 200-400 words", "redditSubreddit": "sideprojects" }`,
  };

  return prompts[postType] || prompts.finance_tip;
}

export async function generatePost(context, postType) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set.');

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://budget-app-keape.vercel.app',
      'X-Title': 'Budget365 Social Agent',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(context, postType) },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('Empty response from OpenRouter');

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in response: ${raw.slice(0, 200)}`);

  return JSON.parse(jsonMatch[0]);
}
