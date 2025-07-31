import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import Transazioni from './Transazioni';
import Budget from './Budget';
import BudgetSettings from './BudgetSettings';
import Filtri from './Filtri';
import Login from './Login';
import Register from './Register';
import ChangePassword from './ChangePassword';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import AboutUs from './AboutUs';
import Navbar from './navbar';
import ProtectedRoute from './ProtectedRoute';
import { ThemeProvider } from './ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/change-password" element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            } />
            <Route path="/about-us" element={
              <ProtectedRoute>
                <>
                  <Navbar />
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <AboutUs />
                  </div>
                </>
              </ProtectedRoute>
            } />
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
            <Route path="/transazioni" element={
              <ProtectedRoute>
                <>
                  <Navbar />
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Transazioni />
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
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
