import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from './ThemeContext';

function Navbar() {
  const { darkMode, toggleDarkMode } = useTheme();

  console.log('✅ Navbar renderizzata');

  return (
    <header className="bg-white dark:bg-gray-800 shadow mb-6">
      <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
        <nav className="space-x-6 text-lg">
          <Link to="/budget" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Budget 2025</Link>
          <Link to="/filtri" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Elenco e filtri</Link>
          <Link
            to="/"
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/'
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            Aggiungi movimento
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
