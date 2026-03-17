import { useState, useEffect } from 'react';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Funzione per decodificare il JWT token
  const decodeToken = (token) => {
    try {
      if (!token) return null;
      
      // Il JWT è composto da tre parti separate da punti: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      // Decodifica il payload (seconda parte)
      const payload = parts[1];
      
      // Aggiungi padding se necessario per base64
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
      
      // Decodifica da base64
      const decodedPayload = atob(paddedPayload);
      
      // Parse JSON
      return JSON.parse(decodedPayload);
    } catch (error) {
      console.error('Errore nel decodificare il token:', error);
      return null;
    }
  };

  // Controlla se il token è scaduto
  const isTokenExpired = (decodedToken) => {
    if (!decodedToken || !decodedToken.exp) return true;
    
    const currentTime = Date.now() / 1000; // Converti in secondi
    return decodedToken.exp < currentTime;
  };

  // Carica i dati utente dal token
  useEffect(() => {
    const loadUserFromToken = () => {
      setIsLoading(true);
      
      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        const decodedToken = decodeToken(token);
        
        if (!decodedToken) {
          // Token non valido, rimuovilo
          localStorage.removeItem('token');
          setUser(null);
          setIsLoading(false);
          return;
        }

        if (isTokenExpired(decodedToken)) {
          // Token scaduto, rimuovilo
          localStorage.removeItem('token');
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Token valido, imposta i dati utente
        setUser({
          userId: decodedToken.userId,
          username: decodedToken.username,
          exp: decodedToken.exp,
          iat: decodedToken.iat
        });
      } catch (error) {
        console.error('Errore nel caricamento utente dal token:', error);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserFromToken();

    // Listener per cambiamenti nel localStorage (per sincronizzare tra tab)
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        loadUserFromToken();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Funzione per logout
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Funzione per ottenere il token
  const getToken = () => {
    return localStorage.getItem('token');
  };

  // Controlla se l'utente è autenticato
  const isAuthenticated = user !== null && !isLoading;

  return {
    user,
    isLoading,
    isAuthenticated,
    logout,
    getToken
  };
};