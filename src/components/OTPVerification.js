import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import BASE_URL from '../config';

function OTPVerification({ username, onSuccess, onBack, maskedEmail }) {
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);

  // Countdown per resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-focus primo input
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleInputChange = (index, value) => {
    // Solo numeri
    if (!/^\d*$/.test(value)) return;
    
    const newOtpCode = [...otpCode];
    newOtpCode[index] = value;
    setOtpCode(newOtpCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }

    // Auto-submit when all fields are filled
    if (value && index === 5 && newOtpCode.every(digit => digit !== '')) {
      handleSubmit(null, newOtpCode.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    // Backspace: move to previous input if current is empty
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
    
    // Enter: submit if all fields filled
    if (e.key === 'Enter') {
      const fullCode = otpCode.join('');
      if (fullCode.length === 6) {
        handleSubmit(e, fullCode);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length === 6) {
      const newOtpCode = pastedData.split('');
      setOtpCode(newOtpCode);
      setError('');
      
      // Focus last input
      if (inputRefs.current[5]) {
        inputRefs.current[5].focus();
      }
      
      // Auto-submit
      handleSubmit(null, pastedData);
    }
  };

  const handleSubmit = async (e, codeOverride = null) => {
    if (e) e.preventDefault();
    
    const fullCode = codeOverride || otpCode.join('');
    
    if (fullCode.length !== 6) {
      setError('Inserisci il codice completo a 6 cifre');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${BASE_URL}/api/auth/verify-otp`, {
        username,
        otpCode: fullCode
      });

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        onSuccess();
      }
    } catch (error) {
      console.error('Errore verifica OTP:', error);
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('Errore durante la verifica del codice');
      }
      
      // Clear OTP code on error
      setOtpCode(['', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/resend-otp`, {
        username
      });
      
      setResendCooldown(60); // 60 seconds cooldown
      setOtpCode(['', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
      
      // Mostra messaggio di successo (opzionale)
      console.log('✅ RESEND OTP:', response.data.message);
    } catch (error) {
      console.error('❌ RESEND ERROR:', error);
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('Errore durante il reinvio del codice');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            Verifica Codice
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Inserisci il codice di 6 cifre inviato a
          </p>
          <p className="font-medium text-indigo-600 dark:text-indigo-400">
            {maskedEmail}
          </p>
        </div>

        {error && (
          <div 
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded"
            role="alert"
            aria-live="polite"
          >
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="flex justify-between space-x-2">
            {otpCode.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="text"
                maxLength="1"
                className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                disabled={loading}
                aria-label={`Cifra ${index + 1} del codice OTP`}
              />
            ))}
          </div>

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading || otpCode.join('').length !== 6}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifica in corso...' : 'Verifica Codice'}
            </button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={loading || resendCooldown > 0}
                className="text-sm text-indigo-600 hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 
                  ? `Reinvia codice tra ${resendCooldown}s` 
                  : 'Reinvia codice'
                }
              </button>

              <button
                type="button"
                onClick={onBack}
                className="block w-full text-sm text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300"
              >
                ← Torna al login
              </button>
            </div>
          </div>
        </form>

        <div className="text-xs text-center text-gray-500 dark:text-gray-400">
          <p>Il codice scade tra 10 minuti</p>
          <p>Massimo 5 tentativi per sessione</p>
        </div>
      </div>
    </div>
  );
}

export default OTPVerification;