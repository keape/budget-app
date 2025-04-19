import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // ✔️ Obbligatorio per attivare Tailwind
import { ThemeProvider } from './ThemeContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
