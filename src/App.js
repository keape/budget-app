import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Home';
import Budget from './Budget';
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
            <Route path="/filtri" element={<Filtri />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
