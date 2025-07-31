import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { useAuth } from './hooks/useAuth';

function Navbar() {
  const { darkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = () => {
    // Usa il logout dell'hook che gestisce anche la pulizia dello stato
    logout();
    // Reindirizza al login
    navigate('/login');
    // Chiudi il menu
    setIsAccountMenuOpen(false);
  };

  console.log('✅ Navbar renderizzata', { darkMode, user: user?.username });

  return (
    <header className="bg-white dark:bg-gray-800 shadow mb-6" role="banner">
      <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Menu principale a sinistra */}
        <nav className="flex space-x-6 text-lg" role="navigation" aria-label="Menu principale">
          <Link 
            to="/" 
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/'
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
            aria-current={location.pathname === '/' ? 'page' : undefined}
          >
            Home
          </Link>
          <Link 
            to="/transazioni" 
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/transazioni'
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
            aria-current={location.pathname === '/transazioni' ? 'page' : undefined}
          >
            Transazioni
          </Link>
          <Link 
            to="/filtri" 
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/filtri'
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
            aria-current={location.pathname === '/filtri' ? 'page' : undefined}
          >
            Filtri
          </Link>
          <Link 
            to="/budget" 
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/budget'
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
            aria-current={location.pathname === '/budget' ? 'page' : undefined}
          >
            Budget
          </Link>
        </nav>
        
        {/* Menu utente e toggle tema a destra */}
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleDarkMode}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleDarkMode();
              }
            }}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label={darkMode ? 'Attiva tema chiaro' : 'Attiva tema scuro'}
            aria-pressed={darkMode}
            title={darkMode ? 'Attiva tema chiaro' : 'Attiva tema scuro'}
          >
            <span aria-hidden="true">{darkMode ? '☀️' : '🌙'}</span>
          </button>
          
          {/* Menu Dropdown Gestione Account */}
          <div className="relative inline-block">
            <button
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsAccountMenuOpen(!isAccountMenuOpen);
                }
                if (e.key === 'Escape') {
                  setIsAccountMenuOpen(false);
                }
              }}
              className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                location.pathname === '/change-password'
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
              aria-expanded={isAccountMenuOpen}
              aria-haspopup="true"
              aria-label="Menu gestione account"
              id="account-menu-button"
            >
              {user?.username ? (
                <>
                  <span className="hidden sm:inline">👤 {user.username}</span>
                  <span className="sm:hidden">👤</span>
                  <span className="ml-1">▼</span>
                </>
              ) : (
                <>Gestione Account ▼</>
              )}
            </button>
            
            {isAccountMenuOpen && (
              <div 
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-600"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="account-menu-button"
              >
                {user?.username && (
                  <div className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 rounded-t-md">
                    <div className="flex items-center">
                      <span className="mr-2">👤</span>
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Account connesso</div>
                      </div>
                    </div>
                  </div>
                )}
                <Link
                  to="/change-password"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center"
                  onClick={() => setIsAccountMenuOpen(false)}
                  role="menuitem"
                  tabIndex={0}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1721 9z" />
                  </svg>
                  Cambia Password
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-md flex items-center"
                  role="menuitem"
                  tabIndex={0}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
