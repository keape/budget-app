import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}

function getRecentCommits() {
  try {
    const log = execSync('git log --oneline -10', { cwd: dirname(__dirname), encoding: 'utf8' });
    return log.trim().split('\n').map(line => {
      const [hash, ...rest] = line.split(' ');
      return rest.join(' ');
    });
  } catch {
    return ['No recent commits found'];
  }
}

function getCompletedFeatures() {
  const features = JSON.parse(readFileSync(join(__dirname, 'features.json'), 'utf8'));
  return features.filter(f => f.status === 'completed');
}

export function getPendingFeatures() {
  const features = JSON.parse(readFileSync(join(__dirname, 'features.json'), 'utf8'));
  return features.filter(f => f.status === 'planned');
}

function getTopVotedFeature() {
  const features = JSON.parse(readFileSync(join(__dirname, 'features.json'), 'utf8'));
  return features
    .filter(f => f.status === 'planned')
    .sort((a, b) => b.votes - a.votes)[0] || null;
}

async function getUserCount() {
  const apiBase = process.env.API_BASE_URL || 'https://budget-app-ios-backend.onrender.com';
  try {
    const res = await fetch(`${apiBase}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return null; // health endpoint doesn't expose user count — return null to use fallback
  } catch {
    return null;
  }
}

export async function gatherContext() {
  const [recentCommits, pendingFeatures, userCount] = await Promise.all([
    Promise.resolve(getRecentCommits()),
    Promise.resolve(getPendingFeatures()),
    getUserCount(),
  ]);

  return {
    recentCommits,
    pendingFeatures,
    completedFeatures: getCompletedFeatures(),
    topVotedFeature: getTopVotedFeature(),
    userCount,
    weekNumber: getWeekNumber(),
    appUrl: 'https://budget-app-keape.vercel.app',
  };
}
