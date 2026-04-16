import { AppState } from 'react-native';
import { API_URL } from '../config';

const HEALTH_URL = `${API_URL}/api/health`;
const PER_TRY_MS = 8000;
const MAX_TOTAL_MS = 90000;
const FRESH_MS = 10 * 60 * 1000; // 10 minuti

let inflight: Promise<boolean> | null = null;
let lastSuccess = 0;

AppState.addEventListener('change', (state) => {
    if (state === 'background') {
        lastSuccess = 0;
        inflight = null;
    }
});

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sveglia il backend Render (free tier) prima che le screen facciano fetch.
 * Ping a /api/health con backoff esponenziale fino a ~90s.
 * Memoizza la Promise in-flight: chiamate concorrenti ricevono la stessa Promise.
 * Dopo 10 minuti di cache, o quando l'app torna in foreground dopo background,
 * il prossimo invito riesegue il ping.
 * Risolve sempre (true = ok, false = timeout totale) — NON rigetta mai,
 * così le fetch a valle partono comunque.
 */
export function warmupBackend(): Promise<boolean> {
    if (Date.now() - lastSuccess < FRESH_MS) {
        return Promise.resolve(true);
    }
    if (inflight) {
        return inflight;
    }
    inflight = doWarmup();
    return inflight;
}

async function doWarmup(): Promise<boolean> {
    const start = Date.now();
    const delays = [0, 500, 1000, 2000, 4000, 8000, 16000];
    let attempt = 0;

    while (Date.now() - start < MAX_TOTAL_MS) {
        const delay = delays[Math.min(attempt, delays.length - 1)];
        if (delay > 0) {
            await sleep(delay);
        }

        const remaining = MAX_TOTAL_MS - (Date.now() - start);
        if (remaining <= 0) break;

        const timeoutMs = Math.min(PER_TRY_MS, remaining);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const res = await fetch(HEALTH_URL, { signal: controller.signal });
            clearTimeout(timer);
            if (res.ok) {
                lastSuccess = Date.now();
                inflight = null;
                return true;
            }
        } catch {
            clearTimeout(timer);
        }

        attempt++;
    }

    inflight = null;
    return false;
}
