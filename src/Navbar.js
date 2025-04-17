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
          <Link to="/budget" className="text-blue-700 dark:text-blue-300 font-semibold hover:underline">
            Budget 2025
          </Link>
          <Link to="/filtri" className="text-blue-700 dark:text-blue-300 font-semibold hover:underline">
            Filtri
          </Link>
          <Link to="/" className="text-blue-700 dark:text-blue-300 font-semibold hover:underline">
            Aggiungi spesa
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
