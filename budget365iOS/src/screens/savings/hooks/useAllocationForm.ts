// ============================================================
// useAllocationForm — form semplificato "scrivi ciò che sai"
// ============================================================
// Logica: un solo campo primario (amount), price auto-fill,
// quantity derivata live. Niente mode toggle.
// ============================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';
import type { InstrumentData, AllocationData, SavingsMonthData } from '../types';

const BASE_URL = API_URL;

export function useAllocationForm(
  savingsMonth: SavingsMonthData | null,
  onSaved: () => void,
) {
  const { userToken } = useAuth();

  // ---- Modal state ----
  const [isOpen, setIsOpen] = useState(false);
  const modalOpenRef = useRef(false);

  // ---- Instrument search ----
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InstrumentData[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentData | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Form fields ----
  const [amount, setAmount] = useState('');           // Campo primario
  const [price, setPrice] = useState('');             // Auto-fill da API, editabile
  const [isPriceFetching, setIsPriceFetching] = useState(false);

  // ---- Computed ----
  const parsedAmount = parseFloat(amount);
  const parsedPrice = parseFloat(price);
  const derivedQuantity =
    !isNaN(parsedAmount) && !isNaN(parsedPrice) && parsedPrice > 0
      ? (parsedAmount / parsedPrice).toFixed(6)
      : null;

  const isValid =
    selectedInstrument != null &&
    !isNaN(parsedAmount) && parsedAmount > 0 &&
    !isNaN(parsedPrice) && parsedPrice > 0;

  // ---- Instrument search ----
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!text.trim()) {
        setSearchResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `${BASE_URL}/api/instruments/search?q=${encodeURIComponent(text)}`,
            { headers: { Authorization: `Bearer ${userToken}` } },
          );
          if (res.ok) {
            const json = await res.json();
            setSearchResults(json.data ?? []);
          }
        } catch {}
      }, 300);
    },
    [userToken],
  );

  const handleSelectInstrument = useCallback(
    (item: InstrumentData) => {
      setSelectedInstrument(item);
      setSearchQuery('');
      setSearchResults([]);
      setPrice('');
      setIsPriceFetching(true);

      fetch(`${BASE_URL}/api/instruments/${encodeURIComponent(item.ticker)}/price`, {
        headers: { Authorization: `Bearer ${userToken}` },
      })
        .then(res => (res.ok ? res.json() : null))
        .then(json => {
          const p = json?.data?.price;
          if (modalOpenRef.current) {
            setIsPriceFetching(false);
            if (p != null) {
              setPrice(prev => (prev === '' ? p.toFixed(2) : prev));
            }
          }
        })
        .catch(() => {
          if (modalOpenRef.current) setIsPriceFetching(false);
        });
    },
    [userToken],
  );

  // ---- Reset ----
  const reset = useCallback(() => {
    modalOpenRef.current = false;
    setIsOpen(false);
    setSelectedInstrument(null);
    setAmount('');
    setPrice('');
    setIsPriceFetching(false);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // ---- Save ----
  const handleSave = useCallback(async () => {
    if (!selectedInstrument || !savingsMonth) return;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Errore', 'Inserisci un importo valido maggiore di 0');
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Errore', 'Il prezzo deve essere maggiore di 0');
      return;
    }

    try {
      const body: any = {
        instrumentId: selectedInstrument._id,
        amount: parsedAmount,
      };
      if (derivedQuantity) body.quantity = parseFloat(derivedQuantity);
      if (price) body.priceAtAllocation = parsedPrice;

      const res = await fetch(
        `${BASE_URL}/api/savings/months/${savingsMonth._id}/allocations`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      if (res.ok) {
        reset();
        onSaved();
      } else {
        const errJson = await res.json().catch(() => ({}));
        Alert.alert('Errore', errJson.error ?? 'Impossibile aggiungere allocazione');
      }
    } catch (e) {
      console.error('saveAllocation error:', e);
    }
  }, [
    selectedInstrument,
    savingsMonth,
    parsedAmount,
    parsedPrice,
    derivedQuantity,
    price,
    userToken,
    reset,
    onSaved,
  ]);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ---- Open ----
  const open = useCallback(() => {
    modalOpenRef.current = true;
    setIsOpen(true);
  }, []);

  return {
    isOpen,
    open,
    reset,
    // Instrument search
    searchQuery,
    searchResults,
    selectedInstrument,
    handleSearchChange,
    handleSelectInstrument,
    clearInstrument: useCallback(() => {
      setSelectedInstrument(null);
      setSearchQuery('');
      setAmount('');
      setPrice('');
    }, []),
    // Form fields
    amount,
    setAmount,
    price,
    setPrice,
    isPriceFetching,
    derivedQuantity,
    isValid,
    handleSave,
  };
}
