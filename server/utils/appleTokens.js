// Verifica dei token di "Accedi con Apple".
//
// Il token di identità arriva dal client (app iOS o browser) e veniva letto con
// jwt.decode, cioè senza controllarne la firma: chiunque conoscesse l'email di un
// utente poteva fabbricarsi un token con quella email e ricevere una sessione
// valida sul suo account. Qui la firma viene verificata con le chiavi pubbliche
// di Apple, quindi un token valido può arrivare solo da Apple.
//
// L'audience (per quale nostra app è stato emesso il token: bundle id per la app
// iOS, Services ID per il sito) viene controllata solo se APPLE_CLIENT_IDS è
// configurata, così il comportamento resta identico finché non la impostiamo.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { debugLog, logError } = require('./logger');

const APPLE_ISSUER = 'https://appleid.apple.com';
const DEFAULT_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Se arriva un token con una chiave sconosciuta si riscarica il mazzo di chiavi,
// ma non più di una volta ogni 5 minuti: token inventati non devono trasformarsi
// in una raffica di richieste verso Apple.
const FORCED_REFRESH_MIN_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

// Sovrascrivibile solo per i test locali: in produzione resta l'indirizzo di Apple.
const jwksUrl = () => process.env.APPLE_JWKS_URL || DEFAULT_JWKS_URL;

let cache = { keys: [], fetchedAt: 0, forcedAt: 0 };

const allowedAudiences = () =>
  (process.env.APPLE_CLIENT_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

async function fetchAppleKeys() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(jwksUrl(), { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`chiavi Apple non disponibili (HTTP ${res.status})`);
    }
    const body = await res.json();
    if (!Array.isArray(body.keys) || body.keys.length === 0) {
      throw new Error('risposta di Apple senza chiavi');
    }
    cache = { keys: body.keys, fetchedAt: Date.now(), forcedAt: cache.forcedAt };
    return cache.keys;
  } finally {
    clearTimeout(timer);
  }
}

async function getAppleKeys(force = false) {
  const isFresh = cache.keys.length > 0 && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (isFresh && !force) return cache.keys;

  if (force) {
    if (Date.now() - cache.forcedAt < FORCED_REFRESH_MIN_MS) return cache.keys;
    cache.forcedAt = Date.now();
  }

  try {
    return await fetchAppleKeys();
  } catch (error) {
    // Apple irraggiungibile: se in memoria ci sono chiavi di meno di 24 ore si
    // usano quelle, altrimenti l'accesso fallisce (meglio negare che fidarsi).
    if (cache.keys.length > 0) {
      debugLog('⚠️ Apple Sign-In: chiavi non aggiornate, uso la cache:', error.message);
      return cache.keys;
    }
    throw error;
  }
}

const jwkToPem = (jwk) =>
  crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ format: 'pem', type: 'spki' }).toString();

// Restituisce le dichiarazioni del token se è autentico, altrimenti solleva un errore
// con un messaggio breve (che non finisce nella risposta HTTP).
async function verifyAppleIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('idToken mancante');
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('token non decodificabile');
  }
  if (decoded.header.alg !== 'RS256') {
    throw new Error(`algoritmo di firma non atteso (${decoded.header.alg})`);
  }

  let keys = await getAppleKeys();
  let jwk = keys.find((key) => key.kid === decoded.header.kid);

  if (!jwk) {
    // Apple ha ruotato le chiavi dopo il nostro ultimo scaricamento.
    keys = await getAppleKeys(true);
    jwk = keys.find((key) => key.kid === decoded.header.kid);
  }
  if (!jwk) {
    throw new Error('chiave di firma Apple non trovata');
  }

  const claims = jwt.verify(idToken, jwkToPem(jwk), {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    clockTolerance: 120
  });

  const audiences = allowedAudiences();
  if (audiences.length > 0) {
    const tokenAudiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!tokenAudiences.some((aud) => audiences.includes(aud))) {
      // Visibile nei log di produzione: serve a capire quale app ha emesso il token
      // quando si attiva il controllo e un client legittimo resta fuori.
      logError('Apple Sign-In: token con audience non autorizzata', claims.aud);
      throw new Error('audience non autorizzata');
    }
  }

  return claims;
}

module.exports = { verifyAppleIdToken };
