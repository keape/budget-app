// Sign in with Apple per la webapp (SDK ufficiale "Sign in with Apple JS").
//
// ATTENZIONE: `REACT_APP_APPLE_SERVICES_ID` è il **Services ID** creato in
// Apple Developer → Identifiers → Services IDs. NON è il bundle id della app iOS
// (`com.keape.budget365`), che vale solo nella app nativa.
//
// L'URL di ritorno è `<origine del sito>/login` e deve essere elencato fra i
// "Return URLs" del Services ID: la pagina che avvia l'accesso e l'URL di ritorno
// devono avere la stessa origine, altrimenti Apple non consegna la risposta e la
// finestra resta aperta. Per questo motivo l'accesso non è testabile in locale.
const APPLE_SCRIPT_SRC = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/it_IT/appleid.auth.js';

export const APPLE_SERVICES_ID = (process.env.REACT_APP_APPLE_SERVICES_ID || '').trim();

// Senza Services ID il pulsante non viene mostrato: è meglio di un pulsante che fallisce sempre.
export const isAppleSignInConfigured = () => APPLE_SERVICES_ID.length > 0;

export const appleRedirectUri = () => `${window.location.origin}/login`;

let applePromise = null;
let initializedFor = null;

// Carica lo script di Apple una sola volta e restituisce l'oggetto `AppleID`.
export function loadAppleSignIn() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Sign in with Apple non disponibile in questo ambiente'));
  }
  if (window.AppleID?.auth) {
    return Promise.resolve(window.AppleID);
  }
  if (applePromise) {
    return applePromise;
  }

  applePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${APPLE_SCRIPT_SRC}"]`);
    const script = existing || document.createElement('script');

    script.addEventListener('load', () => {
      if (window.AppleID?.auth) {
        resolve(window.AppleID);
      } else {
        applePromise = null;
        reject(new Error('Sign in with Apple non inizializzato'));
      }
    }, { once: true });

    script.addEventListener('error', () => {
      applePromise = null;
      reject(new Error('Impossibile caricare Sign in with Apple'));
    }, { once: true });

    if (!existing) {
      script.src = APPLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return applePromise;
}

// `AppleID.auth.init` va chiamata una volta sola per pagina: richiamarla a ogni
// render (React lo fa) lascerebbe l'SDK in uno stato incoerente.
export function initAppleSignIn() {
  if (!isAppleSignInConfigured() || !window.AppleID?.auth) {
    return false;
  }
  if (initializedFor === APPLE_SERVICES_ID) {
    return true;
  }

  window.AppleID.auth.init({
    clientId: APPLE_SERVICES_ID,
    scope: 'name email',
    redirectURI: appleRedirectUri(),
    usePopup: true
  });

  initializedFor = APPLE_SERVICES_ID;
  return true;
}
