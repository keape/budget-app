import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import BASE_URL from './config';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import InstrumentSearch from './components/InstrumentSearch';
import ResponsiveTable from './components/ResponsiveTable';

const mesiNomi = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

function formatCurrency(value) {
  if (value == null) return 'N/D';
  return `€ ${Number(value).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Savings() {
  const [activeTab, setActiveTab] = useState('mese');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // data
  const [savingsMonth, setSavingsMonth] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [plan, setPlan] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // add allocation form
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [newAmount, setNewAmount] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [isSavingAlloc, setIsSavingAlloc] = useState(false);

  // add plan form
  const [showAddPlanForm, setShowAddPlanForm] = useState(false);
  const [planInstrument, setPlanInstrument] = useState(null);
  const [planPct, setPlanPct] = useState('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'mese') {
        const monthsRes = await axios.get(`${BASE_URL}/api/savings/months`).catch(() => null);
        if (monthsRes?.data?.success) {
          const month = monthsRes.data.data.find(
            m => m.anno === selectedYear && m.mese === selectedMonth
          ) ?? null;
          setSavingsMonth(month);
          if (month) {
            const allocRes = await axios
              .get(`${BASE_URL}/api/savings/months/${month._id}/allocations`)
              .catch(() => null);
            setAllocations(allocRes?.data?.data ?? []);
          } else {
            setAllocations([]);
          }
        } else {
          setSavingsMonth(null);
          setAllocations([]);
        }
      }
      if (activeTab === 'piano') {
        const planRes = await axios.get(`${BASE_URL}/api/savings/plan`).catch(() => null);
        setPlan(planRes?.data?.data ?? null);
      }
      if (activeTab === 'portfolio') {
        const portRes = await axios.get(`${BASE_URL}/api/savings/portfolio`).catch(() => null);
        setPortfolio(portRes?.data?.data ?? []);
      }
    } catch (err) {
      setError('Errore nel caricamento dei dati.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedMonth, selectedYear]);

  // ------ Month navigation helpers ------
  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  // ------ Add allocation ------
  const handleAddAllocation = async () => {
    if (!savingsMonth || !selectedInstrument || !newAmount) return;
    setIsSavingAlloc(true);
    try {
      const body = {
        instrumentId: selectedInstrument._id,
        ticker: selectedInstrument.ticker,
        name: selectedInstrument.name,
        amount: parseFloat(newAmount),
        quantity: newQuantity ? parseFloat(newQuantity) : undefined,
        price: newPrice ? parseFloat(newPrice) : undefined,
      };
      await axios.post(
        `${BASE_URL}/api/savings/months/${savingsMonth._id}/allocations`,
        body
      );
      setShowAddForm(false);
      setSelectedInstrument(null);
      setNewAmount('');
      setNewQuantity('');
      setNewPrice('');
      await loadData();
    } catch (err) {
      setError('Errore nel salvataggio dell\'allocazione.');
    } finally {
      setIsSavingAlloc(false);
    }
  };

  const handleDeleteAllocation = async (allocId) => {
    if (!savingsMonth) return;
    if (!window.confirm('Confermi la rimozione?')) return;
    try {
      await axios.delete(
        `${BASE_URL}/api/savings/months/${savingsMonth._id}/allocations/${allocId}`
      );
      await loadData();
    } catch {
      setError('Errore nell\'eliminazione dell\'allocazione.');
    }
  };

  // ------ Plan ------
  const handleAddPlanEntry = async () => {
    if (!planInstrument || !planPct) return;
    setIsSavingPlan(true);
    try {
      const existing = plan?.allocations ?? [];
      const updated = [
        ...existing,
        {
          ticker: planInstrument.ticker,
          name: planInstrument.name,
          instrumentId: planInstrument._id,
          targetPct: parseFloat(planPct),
        },
      ];
      await axios.put(`${BASE_URL}/api/savings/plan`, { allocations: updated });
      setShowAddPlanForm(false);
      setPlanInstrument(null);
      setPlanPct('');
      await loadData();
    } catch {
      setError('Errore nel salvataggio del piano.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleDeletePlanEntry = async (index) => {
    if (!window.confirm('Confermi la rimozione?')) return;
    const existing = plan?.allocations ?? [];
    const updated = existing.filter((_, i) => i !== index);
    try {
      await axios.put(`${BASE_URL}/api/savings/plan`, { allocations: updated });
      await loadData();
    } catch {
      setError('Errore nell\'eliminazione della voce del piano.');
    }
  };

  // ------ Derived values ------
  const totalPct = (plan?.allocations ?? []).reduce(
    (sum, a) => sum + (a.targetPct ?? 0),
    0
  );

  const portfolioTotal = portfolio.reduce((sum, p) => {
    const v = p.estimatedCurrentValue ?? p.totalAmount ?? 0;
    return sum + v;
  }, 0);

  // Comparison data: match plan allocations with actual
  const comparisonData = useMemo(() => {
    if (!plan?.allocations?.length || !allocations.length) return [];
    const totalAllocated = allocations.reduce((s, a) => s + (a.amount ?? 0), 0);
    return plan.allocations.map(pa => {
      const actual = allocations.filter(a => a.ticker === pa.ticker);
      const actualAmount = actual.reduce((s, a) => s + (a.amount ?? 0), 0);
      const actualPct = totalAllocated > 0 ? (actualAmount / totalAllocated) * 100 : 0;
      return { ...pa, actualPct: Math.round(actualPct * 10) / 10 };
    });
  }, [allocations, plan]);

  // ------ Allocations table columns ------
  const allocColumns = [
    {
      header: 'Strumento',
      key: 'ticker',
      render: (row) => (
        <span className="font-medium">
          {row.ticker ?? row.name ?? 'N/D'}
          {row.name && row.ticker && (
            <span className="ml-2 text-gray-500 dark:text-gray-400 font-normal text-xs">{row.name}</span>
          )}
        </span>
      ),
    },
    {
      header: 'Importo',
      key: 'amount',
      render: (row) => (
        <span className="font-semibold text-indigo-700 dark:text-indigo-300">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      header: 'Quote',
      key: 'quantity',
      render: (row) => (
        <span className="text-gray-600 dark:text-gray-400">
          {row.quantity != null ? row.quantity : '—'}
        </span>
      ),
    },
    {
      header: '',
      key: 'delete',
      render: (row) => (
        <button
          onClick={() => handleDeleteAllocation(row._id)}
          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
          title="Elimina"
        >
          ✕
        </button>
      ),
    },
  ];

  // ------ Plan table columns ------
  const planColumns = [
    {
      header: 'Strumento',
      key: 'ticker',
      render: (row) => (
        <span className="font-medium">
          {row.ticker ?? 'N/D'}
          {row.name && (
            <span className="ml-2 text-gray-500 dark:text-gray-400 font-normal text-xs">{row.name}</span>
          )}
        </span>
      ),
    },
    {
      header: 'Target %',
      key: 'targetPct',
      render: (row) => (
        <span className="font-semibold text-indigo-700 dark:text-indigo-300">
          {row.targetPct ?? 0}%
        </span>
      ),
    },
    {
      header: '',
      key: 'delete',
      render: (row) => (
        <button
          onClick={() => handleDeletePlanEntry(row._originalIndex)}
          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
          title="Elimina"
        >
          ✕
        </button>
      ),
    },
  ];

  // ------ Portfolio table columns ------
  const portfolioColumns = [
    {
      header: 'Ticker',
      key: 'ticker',
      render: (row) => (
        <span className="font-bold text-gray-900 dark:text-white">{row.ticker ?? 'N/D'}</span>
      ),
    },
    {
      header: 'Nome',
      key: 'name',
      render: (row) => (
        <span className="text-gray-700 dark:text-gray-300">{row.name ?? 'N/D'}</span>
      ),
    },
    {
      header: 'Totale Investito',
      key: 'totalAmount',
      render: (row) => (
        <span className="font-semibold">{formatCurrency(row.totalAmount)}</span>
      ),
    },
    {
      header: 'Quote',
      key: 'totalQuantity',
      render: (row) => (
        <span className="text-gray-600 dark:text-gray-400">
          {row.totalQuantity != null ? row.totalQuantity : '—'}
        </span>
      ),
    },
    {
      header: 'Prezzo Attuale',
      key: 'lastPrice',
      render: (row) => (
        <span className="text-gray-600 dark:text-gray-400">
          {row.instrument?.lastPrice != null ? formatCurrency(row.instrument.lastPrice) : '—'}
        </span>
      ),
    },
    {
      header: 'Valore Stimato',
      key: 'estimatedCurrentValue',
      render: (row) => (
        <span
          className={`font-semibold ${
            row.estimatedCurrentValue != null
              ? row.estimatedCurrentValue >= (row.totalAmount ?? 0)
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {row.estimatedCurrentValue != null ? formatCurrency(row.estimatedCurrentValue) : 'N/D'}
        </span>
      ),
    },
  ];

  // ========================
  // RENDER
  // ========================
  return (
    <div>
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Risparmio &amp; Portfolio
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestisci risparmi mensili e portafoglio investimenti
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-400 hover:text-red-600 dark:hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          {['mese', 'piano', 'portfolio'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'mese' ? '📅 Mese' : tab === 'piano' ? '🎯 Piano' : '💼 Portfolio'}
            </button>
          ))}
        </div>

        {/* Loading spinner */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
          </div>
        )}

        {/* ======================== TAB MESE ======================== */}
        {!isLoading && activeTab === 'mese' && (
          <div>
            {/* Month/Year selector */}
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={prevMonth}
                className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                aria-label="Mese precedente"
              >
                ←
              </button>
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  {mesiNomi.map((nome, idx) => (
                    <option key={idx} value={idx}>{nome}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={nextMonth}
                className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                aria-label="Mese successivo"
              >
                →
              </button>
            </div>

            {savingsMonth === null ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-10 text-center shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="text-gray-400 dark:text-gray-500 text-lg">
                  Nessun dato per questo mese
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                  {mesiNomi[selectedMonth]} {selectedYear}
                </p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                    <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Entrate</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(savingsMonth.totalIncome)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                    <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Uscite</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(savingsMonth.totalExpenses)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                    <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Risparmio</p>
                    <p
                      className={`text-2xl font-bold ${
                        (savingsMonth.savings ?? 0) >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatCurrency(savingsMonth.savings)}
                    </p>
                  </div>
                </div>

                {/* Allocations section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Allocazioni</h2>
                    <button
                      onClick={() => setShowAddForm(f => !f)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
                    >
                      + Aggiungi allocazione
                    </button>
                  </div>

                  {allocations.length === 0 ? (
                    <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">
                      Nessuna allocazione per questo mese
                    </p>
                  ) : (
                    <ResponsiveTable
                      data={allocations}
                      columns={allocColumns}
                    />
                  )}

                  {/* Inline add-allocation form */}
                  {showAddForm && (
                    <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                      <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-3">
                        Nuova allocazione
                      </h3>

                      {/* Instrument search */}
                      {selectedInstrument ? (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-100 rounded-full text-sm font-medium">
                            <span className="font-bold">{selectedInstrument.ticker}</span>
                            <span className="text-indigo-600 dark:text-indigo-300 text-xs">
                              {selectedInstrument.name}
                            </span>
                            <button
                              onClick={() => setSelectedInstrument(null)}
                              className="ml-1 text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-100"
                            >
                              ×
                            </button>
                          </span>
                        </div>
                      ) : (
                        <div className="mb-3">
                          <InstrumentSearch onSelect={setSelectedInstrument} />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Importo (€) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={newAmount}
                            onChange={(e) => setNewAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Quote (opzionale)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            placeholder="0"
                            value={newQuantity}
                            onChange={(e) => setNewQuantity(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Prezzo (opzionale)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleAddAllocation}
                          disabled={isSavingAlloc || !selectedInstrument || !newAmount}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm rounded-lg transition-colors"
                        >
                          {isSavingAlloc ? 'Salvataggio...' : 'Salva'}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddForm(false);
                            setSelectedInstrument(null);
                            setNewAmount('');
                            setNewQuantity('');
                            setNewPrice('');
                          }}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Piano vs Reale comparison */}
                {plan?.allocations?.length > 0 && allocations.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Piano vs Reale
                    </h2>
                    <div className="space-y-4">
                      {comparisonData.map((item, idx) => {
                        const diff = item.actualPct - (item.targetPct ?? 0);
                        const color =
                          item.actualPct >= (item.targetPct ?? 0)
                            ? 'text-green-600 dark:text-green-400'
                            : diff >= -10
                            ? 'text-orange-500 dark:text-orange-400'
                            : 'text-red-600 dark:text-red-400';
                        const barColor =
                          item.actualPct >= (item.targetPct ?? 0)
                            ? 'bg-green-500'
                            : diff >= -10
                            ? 'bg-orange-400'
                            : 'bg-red-500';

                        return (
                          <div key={item.ticker ?? idx}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {item.ticker ?? item.name}
                              </span>
                              <span className={`text-sm font-semibold ${color}`}>
                                {item.actualPct}% / {item.targetPct}%
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                style={{ width: `${Math.min(item.actualPct, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ======================== TAB PIANO ======================== */}
        {!isLoading && activeTab === 'piano' && (
          <div>
            {plan === null || !(plan?.allocations?.length) ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-10 text-center shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
                <p className="text-gray-400 dark:text-gray-500 text-lg">Nessun piano configurato</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                  Aggiungi strumenti e percentuali target per creare il tuo piano di allocazione
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Allocazioni Piano
                  </h2>
                  <button
                    onClick={() => setShowAddPlanForm(f => !f)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
                  >
                    + Aggiungi strumento
                  </button>
                </div>

                <ResponsiveTable
                  data={(plan.allocations ?? []).map((a, i) => ({ ...a, _originalIndex: i }))}
                  columns={planColumns}
                />

                {/* Total */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">Totale:</span>
                  <span
                    className={`text-sm font-bold ${
                      totalPct > 100
                        ? 'text-red-600 dark:text-red-400'
                        : totalPct === 100
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {totalPct}%
                  </span>
                </div>
              </div>
            )}

            {/* Add plan entry button (shown when no plan exists too) */}
            {(plan === null || !(plan?.allocations?.length)) && (
              <div className="flex justify-center">
                <button
                  onClick={() => setShowAddPlanForm(f => !f)}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  + Aggiungi strumento
                </button>
              </div>
            )}

            {/* Inline add plan form */}
            {showAddPlanForm && (
              <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-3">
                  Nuovo strumento nel piano
                </h3>

                {planInstrument ? (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-100 rounded-full text-sm font-medium">
                      <span className="font-bold">{planInstrument.ticker}</span>
                      <span className="text-indigo-600 dark:text-indigo-300 text-xs">
                        {planInstrument.name}
                      </span>
                      <button
                        onClick={() => setPlanInstrument(null)}
                        className="ml-1 text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-100"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                ) : (
                  <div className="mb-3">
                    <InstrumentSearch onSelect={setPlanInstrument} />
                  </div>
                )}

                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Percentuale target (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="0"
                    value={planPct}
                    onChange={(e) => setPlanPct(e.target.value)}
                    className="w-full sm:w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAddPlanEntry}
                    disabled={isSavingPlan || !planInstrument || !planPct}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm rounded-lg transition-colors"
                  >
                    {isSavingPlan ? 'Salvataggio...' : 'Salva'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddPlanForm(false);
                      setPlanInstrument(null);
                      setPlanPct('');
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}

            {/* Total shown below add form too when plan has entries */}
            {plan?.allocations?.length > 0 && totalPct > 100 && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400 font-semibold text-right">
                Attenzione: la somma delle percentuali supera il 100% ({totalPct}%)
              </p>
            )}
          </div>
        )}

        {/* ======================== TAB PORTFOLIO ======================== */}
        {!isLoading && activeTab === 'portfolio' && (
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Portafoglio
                </h2>
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors flex items-center gap-2"
                >
                  🔄 Aggiorna prezzi
                </button>
              </div>

              {portfolio.length === 0 ? (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">
                  Nessun dato di portafoglio disponibile
                </p>
              ) : (
                <>
                  <ResponsiveTable
                    data={portfolio}
                    columns={portfolioColumns}
                  />

                  {/* Total row */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Totale Portafoglio
                    </span>
                    <span className="text-base font-bold text-indigo-700 dark:text-indigo-300">
                      {formatCurrency(portfolioTotal)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Bar chart */}
            {portfolio.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Distribuzione Portafoglio
                </h2>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={portfolio.map(p => ({
                      ticker: p.ticker ?? p.name ?? 'N/D',
                      importo: p.totalAmount ?? 0,
                    }))}
                    margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
                  >
                    <XAxis
                      dataKey="ticker"
                      angle={-35}
                      textAnchor="end"
                      height={70}
                      interval={0}
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                    />
                    <YAxis
                      tickFormatter={(v) => `€${v.toLocaleString('it-IT')}`}
                      tick={{ fill: '#6B7280', fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) => [`€ ${Number(value).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 'Totale investito']}
                    />
                    <Bar dataKey="importo" fill="#6366f1" radius={[4, 4, 0, 0]} name="Totale investito" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
