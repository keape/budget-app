import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../ThemeContext';
import {
  GOOGLE_WEB_CLIENT_ID,
  isGoogleSignInConfigured,
  loadGoogleIdentityServices
} from '../utils/googleSignIn';

// Pulsante ufficiale "Accedi con Google" (Google Identity Services).
// Il click avviene dentro l'iframe di Google: il token arriva via callback `credential`.
// Se il client id web non è configurato il componente non renderizza nulla.
function GoogleSignInButton({ onCredential, onError, disabled = false }) {
  const { darkMode } = useTheme();
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [width, setWidth] = useState(0);

  const configured = isGoogleSignInConfigured();

  // Callback tenute in ref: il parent può ri-renderizzare (es. digitazione) senza
  // ricreare l'iframe del pulsante.
  const credentialRef = useRef(onCredential);
  const errorRef = useRef(onError);

  useEffect(() => { credentialRef.current = onCredential; }, [onCredential]);
  useEffect(() => { errorRef.current = onError; }, [onError]);

  const handleCredential = useCallback((response) => {
    if (response?.credential) {
      credentialRef.current?.(response.credential);
    } else {
      errorRef.current?.('Google non ha restituito un token valido. Riprova.');
    }
  }, []);

  // La larghezza del pulsante GIS è fissa (200-400px): la misuro dal contenitore.
  useEffect(() => {
    if (!configured) return undefined;

    const measure = () => {
      const available = wrapperRef.current?.clientWidth || 0;
      setWidth(Math.max(200, Math.min(400, Math.floor(available) || 320)));
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [configured]);

  useEffect(() => {
    if (!configured) return undefined;
    let cancelled = false;

    loadGoogleIdentityServices()
      .then(() => {
        if (!cancelled) setScriptReady(true);
      })
      .catch((error) => {
        if (!cancelled) errorRef.current?.('Servizio di accesso Google non disponibile. Riprova più tardi.');
        console.error('Google Sign-In: caricamento GIS fallito', error);
      });

    return () => { cancelled = true; };
  }, [configured]);

  useEffect(() => {
    if (!scriptReady || !width || !buttonRef.current || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_WEB_CLIENT_ID,
      callback: handleCredential,
      auto_select: false,
      cancel_on_tap_outside: true
    });

    // Evita pulsanti duplicati quando il componente si ri-renderizza (es. cambio tema).
    buttonRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: darkMode ? 'filled_black' : 'outline',
      size: 'large',
      shape: 'rectangular',
      logo_alignment: 'left',
      text: 'continue_with',
      width
    });
  }, [scriptReady, width, darkMode, handleCredential]);

  if (!configured) return null;

  return (
    <div
      ref={wrapperRef}
      className={`w-full flex justify-center ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
      aria-busy={disabled}
    >
      {/* Il contenuto è generato da Google: non può usare le classi Tailwind del sito. */}
      <div ref={buttonRef} />
    </div>
  );
}

export default GoogleSignInButton;
