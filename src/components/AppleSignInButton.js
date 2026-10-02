import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  isAppleSignInConfigured,
  loadAppleSignIn,
  initAppleSignIn
} from '../utils/appleSignIn';

// Pulsante "Accedi con Apple" (Sign in with Apple JS).
// Il click apre la finestra di Apple, che restituisce un token di identità: la verifica
// avviene nel backend, come per Google. Se il Services ID non è configurato il
// componente non renderizza nulla.
//
// L'aspetto segue le linee guida Apple: fondo nero con logo e testo bianchi, oppure
// fondo bianco con testo nero (variante usata in tema scuro).
function AppleLogo({ className }) {
  return (
    <svg viewBox="0 0 384 512" className={className} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

// La chiusura della finestra da parte dell'utente non è un errore da mostrare.
const isCancellation = (error) => {
  const code = typeof error === 'string' ? error : error?.error;
  return code === 'popup_closed_by_user'
    || code === 'user_cancelled_authorize'
    || code === 'user_cancelled_login';
};

function AppleSignInButton({ onCredential, onError, disabled = false }) {
  const [scriptReady, setScriptReady] = useState(false);

  const configured = isAppleSignInConfigured();

  // Callback tenute in ref: il parent può ri-renderizzare (es. digitazione) senza
  // perdere l'inizializzazione del SDK.
  const credentialRef = useRef(onCredential);
  const errorRef = useRef(onError);

  useEffect(() => { credentialRef.current = onCredential; }, [onCredential]);
  useEffect(() => { errorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!configured) return undefined;
    let cancelled = false;

    loadAppleSignIn()
      .then(() => {
        if (cancelled) return;
        setScriptReady(initAppleSignIn());
      })
      .catch((error) => {
        if (cancelled) return;
        errorRef.current?.('Servizio di accesso Apple non disponibile. Riprova più tardi.');
        console.error('Apple Sign-In: caricamento non riuscito', error);
      });

    return () => { cancelled = true; };
  }, [configured]);

  const handleClick = useCallback(async () => {
    const auth = window.AppleID?.auth;
    if (!auth || typeof auth.signIn !== 'function') {
      errorRef.current?.('Servizio di accesso Apple non disponibile. Riprova più tardi.');
      return;
    }

    try {
      // Con usePopup il risultato arriva qui: nessun passaggio dal server di Apple.
      const response = await auth.signIn();
      const idToken = response?.authorization?.id_token;

      if (idToken) {
        // `user` (nome ed email) Apple lo manda solo al primo accesso.
        credentialRef.current?.(idToken, response.user);
      } else {
        errorRef.current?.('Apple non ha restituito un token valido. Riprova.');
      }
    } catch (error) {
      if (isCancellation(error)) return;
      console.error('Apple Sign-In: accesso non riuscito', error);
      errorRef.current?.('Accesso con Apple non riuscito. Riprova.');
    }
  }, []);

  if (!configured) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || !scriptReady}
      aria-busy={disabled}
      className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-medium bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <AppleLogo className="w-4 h-4" />
      <span>Accedi con Apple</span>
    </button>
  );
}

export default AppleSignInButton;
