// ============================================================
// useSavingsData — fetch + cache + AbortController per tab
// ============================================================
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { API_URL } from '../../config';
import { warmupBackend } from '../../utils/apiClient';
import type {
  SavingsMonthData,
  AllocationData,
  PlanData,
  PortfolioItem,
  ActiveTab,
} from '../types';

const BASE_URL = API_URL;

type CacheKey = string; // `${tab}|${month}|${year}`

interface CacheEntry {
  savingsMonth: SavingsMonthData | null;
  allocations: AllocationData[];
  plan: PlanData | null;
  portfolio: PortfolioItem[];
  fetchedAt: number;
}

const CACHE_TTL = 120_000; // 2 minuti
const cache = new Map<CacheKey, CacheEntry>();

export function useSavingsData(
  activeTab: ActiveTab,
  selectedMonth: number,
  selectedYear: number,
) {
  const { userToken } = useAuth();
  const { currency, isDarkMode, showBalance } = useSettings();

  const [savingsMonth, setSavingsMonth] = useState<SavingsMonthData | null>(null);
  const [allocations, setAllocations] = useState<AllocationData[]>([]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const lastKeyRef = useRef<CacheKey>('');

  const cacheKey: CacheKey = `${activeTab}|${selectedMonth}|${selectedYear}`;

  // ---- Fetch helpers ----

  const fetchMese = useCallback(
    async (signal: AbortSignal) => {
      if (!userToken) return;
      await warmupBackend();
      if (signal.aborted) return;

      // 1. Get months list
      const monthsRes = await fetch(`${BASE_URL}/api/savings/months`, {
        headers: { Authorization: `Bearer ${userToken}` },
        signal,
      });
      if (!monthsRes.ok || signal.aborted) {
        setSavingsMonth(null);
        setAllocations([]);
        return;
      }
      const monthsJson = await monthsRes.json();
      if (signal.aborted) return;

      let month = monthsJson.data?.find(
        (m: any) => m.anno === selectedYear && m.mese === selectedMonth,
      ) ?? null;

      // 2. Ensure month if past
      if (!month) {
        const now = new Date();
        const isFutureOrCurrent =
          selectedYear > now.getFullYear() ||
          (selectedYear === now.getFullYear() && selectedMonth >= now.getMonth());
        if (!isFutureOrCurrent) {
          const ensureRes = await fetch(`${BASE_URL}/api/savings/ensure-month`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${userToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ anno: selectedYear, mese: selectedMonth }),
            signal,
          });
          if (!signal.aborted && ensureRes.ok) {
            const ensureJson = await ensureRes.json();
            if (!signal.aborted) month = ensureJson.data ?? null;
          }
        }
      }

      if (signal.aborted) return;
      setSavingsMonth(month);

      // 3. Fetch allocations
      if (month) {
        const allocRes = await fetch(
          `${BASE_URL}/api/savings/months/${month._id}/allocations`,
          { headers: { Authorization: `Bearer ${userToken}` }, signal },
        );
        if (!signal.aborted && allocRes.ok) {
          const allocJson = await allocRes.json();
          if (!signal.aborted) setAllocations(allocJson.data ?? []);
        }
      } else {
        setAllocations([]);
      }
    },
    [userToken, selectedMonth, selectedYear],
  );

  const fetchPiano = useCallback(
    async (signal: AbortSignal) => {
      if (!userToken) return;
      await warmupBackend();
      if (signal.aborted) return;

      const planRes = await fetch(`${BASE_URL}/api/savings/plan`, {
        headers: { Authorization: `Bearer ${userToken}` },
        signal,
      });
      if (signal.aborted) return;
      if (planRes.ok) {
        const planJson = await planRes.json();
        if (!signal.aborted) setPlan(planJson.data);
      }
    },
    [userToken],
  );

  const fetchPortfolio = useCallback(
    async (signal: AbortSignal) => {
      if (!userToken) return;
      await warmupBackend();
      if (signal.aborted) return;

      const portRes = await fetch(`${BASE_URL}/api/savings/portfolio`, {
        headers: { Authorization: `Bearer ${userToken}` },
        signal,
      });
      if (signal.aborted) return;
      if (portRes.ok) {
        const portJson = await portRes.json();
        if (!signal.aborted) setPortfolio(portJson.data ?? []);
      }
    },
    [userToken],
  );

  const loadData = useCallback(
    async (signal: AbortSignal) => {
      if (!userToken) return;
      setError(null);

      // Try cache
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        setSavingsMonth(cached.savingsMonth);
        setAllocations(cached.allocations);
        setPlan(cached.plan);
        setPortfolio(cached.portfolio);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        if (activeTab === 'mese') await fetchMese(signal);
        else if (activeTab === 'piano') await fetchPiano(signal);
        else if (activeTab === 'portfolio') await fetchPortfolio(signal);

        if (!signal.aborted) {
          // Populate cache after successful fetch
          cache.set(cacheKey, {
            savingsMonth: savingsMonthRef.current,
            allocations: allocationsRef.current,
            plan: planRef.current,
            portfolio: portfolioRef.current,
            fetchedAt: Date.now(),
          });
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('useSavingsData error:', e);
          setError('Errore nel caricamento dei dati');
        }
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    },
    [userToken, activeTab, cacheKey, fetchMese, fetchPiano, fetchPortfolio],
  );

  // Refs for cache update after setState
  const savingsMonthRef = useRef(savingsMonth);
  const allocationsRef = useRef(allocations);
  const planRef = useRef(plan);
  const portfolioRef = useRef(portfolio);
  useEffect(() => { savingsMonthRef.current = savingsMonth; }, [savingsMonth]);
  useEffect(() => { allocationsRef.current = allocations; }, [allocations]);
  useEffect(() => { planRef.current = plan; }, [plan]);
  useEffect(() => { portfolioRef.current = portfolio; }, [portfolio]);

  // ---- Trigger loads on tab/month/year change ----
  useEffect(() => {
    mountedRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastKeyRef.current = cacheKey;

    loadData(controller.signal);

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [cacheKey, loadData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ---- Public API ----
  const reload = useCallback(() => {
    cache.delete(cacheKey);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    loadData(controller.signal);
  }, [cacheKey, loadData]);

  const invalidateCache = useCallback(() => {
    cache.clear();
  }, []);

  return {
    // State
    savingsMonth,
    allocations,
    plan,
    portfolio,
    isLoading,
    error,
    // Settings pass-through
    currency,
    isDarkMode,
    showBalance,
    // Actions
    reload,
    invalidateCache,
  };
}
