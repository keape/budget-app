import React, { useState, useRef } from 'react';
import axios from 'axios';
import BASE_URL from '../config';

export default function InstrumentSearch({ onSelect, placeholder = 'Cerca ticker o nome...' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${BASE_URL}/api/instruments/search`, { params: { q: val } });
        setResults(res.data.data ?? []);
      } catch {} finally { setLoading(false); }
    }, 300);
  };

  const handleSelect = (instrument) => {
    onSelect(instrument);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
        </div>
      )}
      {results.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
          style={{ position: 'absolute' }}
        >
          {results.map((instrument, index) => (
            <button
              key={instrument.ticker ?? index}
              onClick={() => handleSelect(instrument)}
              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <span className="font-bold text-gray-900 dark:text-white shrink-0">{instrument.ticker}</span>
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{instrument.name}</span>
              </div>
              {instrument.type && (
                <span className="ml-2 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                  {instrument.type}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
