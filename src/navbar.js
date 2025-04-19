import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeContext';

function Navbar() {
  const { darkMode, toggleDarkMode } = useTheme();
  const location = useLocation();

  console.log('✅ Navbar renderizzata');

  return (
    <header className="bg-white dark:bg-gray-800 shadow mb-6">
      <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
        <nav className="space-x-6 text-lg">
          <Link 
            to="/" 
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/'
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            Home
          </Link>
          <Link 
            to="/budget-entrate" 
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/budget-entrate'
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            Entrate
          </Link>
          <Link 
            to="/filtri" 
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/filtri'
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            Elenco e filtri
          </Link>
        </nav>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}

export default Navbar;
