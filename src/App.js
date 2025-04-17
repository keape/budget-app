import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Home';
import Budget from './Budget';
import BudgetEntrate from './BudgetEntrate';
import EntrateForm from './EntrateForm';
import Navbar from './Navbar';
import Filtri from './Filtri';
import { ThemeProvider } from './ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="theme-container min-h-screen">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/budget-entrate" element={<BudgetEntrate />} />
            <Route path="/aggiungi-entrata" element={<EntrateForm />} />
            <Route path="/filtri" element={<Filtri />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
