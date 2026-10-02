// Google Identity Services (GIS) per la webapp.
//
// ATTENZIONE: `REACT_APP_GOOGLE_CLIENT_ID` deve essere un OAuth client di tipo
// **Web application**. Il client iOS usato da budget365iOS funziona solo nella app nativa
// e nel browser viene rifiutato da Google (origin non autorizzata).
// L'origine del sito va elencata in console Google Cloud → Credenziali → Origini JavaScript autorizzate.
const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export const GOOGLE_WEB_CLIENT_ID = (process.env.REACT_APP_GOOGLE_CLIENT_ID || '').trim();

// Senza client id valido il pulsante non viene mostrato: è meglio di un pulsante che fallisce sempre.
export const isGoogleSignInConfigured = () => GOOGLE_WEB_CLIENT_ID.length > 0;

let gsiPromise = null;

// Carica lo script GIS una sola volta e restituisce `google.accounts.id`.
export function loadGoogleIdentityServices() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Identity Services non disponibile in questo ambiente'));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }
  if (gsiPromise) {
    return gsiPromise;
  }

  gsiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SCRIPT_SRC}"]`);
    const script = existing || document.createElement('script');

    script.addEventListener('load', () => {
      if (window.google?.accounts?.id) {
        resolve(window.google.accounts.id);
      } else {
        gsiPromise = null;
        reject(new Error('Google Identity Services non inizializzato'));
      }
    }, { once: true });

    script.addEventListener('error', () => {
      gsiPromise = null;
      reject(new Error('Impossibile caricare Google Identity Services'));
    }, { once: true });

    if (!existing) {
      script.src = GSI_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return gsiPromise;
}
