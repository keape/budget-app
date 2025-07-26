import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from './ThemeContext';

function Navbar() {
  const { darkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  const handleLogout = () => {
    // Rimuovi il token dal localStorage
    localStorage.removeItem('token');
    // Reindirizza al login
    navigate('/login');
    // Chiudi il menu
    setIsAccountMenuOpen(false);
  };

  console.log('✅ Navbar renderizzata', { darkMode });

  return (
    <header className="bg-white dark:bg-gray-800 shadow mb-6">
      <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
        <nav className="space-x-6 text-lg">
          <Link 
            to="/budget" 
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/budget'
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            Budget
          </Link>
          <Link 
            to="/filtri" 
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/filtri'
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            Movimenti
          </Link>
          <Link 
            to="/" 
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/'
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            Inserisci transazione
          </Link>
          
          {/* Menu Dropdown Gestione Account */}
          <div className="relative inline-block">
            <button
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                location.pathname === '/change-password'
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              Gestione Account ▼
            </button>
            
            {isAccountMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-600">
                <Link
                  to="/change-password"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-t-md"
                  onClick={() => setIsAccountMenuOpen(false)}
                >
                  Cambia Password
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-md"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </nav>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
