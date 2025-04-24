import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import Budget from './Budget';
import BudgetSettings from './BudgetSettings';
import Filtri from './Filtri';
import Login from './Login';
import Register from './Register';
import Navbar from './navbar';
import ProtectedRoute from './ProtectedRoute';
import { ThemeProvider } from './ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={
              <ProtectedRoute>
                <>
                  <Navbar />
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Home />
                  </div>
                </>
              </ProtectedRoute>
            } />
            <Route path="/budget" element={
              <ProtectedRoute>
                <>
                  <Navbar />
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Budget />
                  </div>
                </>
              </ProtectedRoute>
            } />
            <Route path="/budget/settings" element={
              <ProtectedRoute>
                <>
                  <Navbar />
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <BudgetSettings />
                  </div>
                </>
              </ProtectedRoute>
            } />
            <Route path="/filtri" element={
              <ProtectedRoute>
                <>
                  <Navbar />
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Filtri />
                  </div>
                </>
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
