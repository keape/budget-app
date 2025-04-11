import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import Filtri from './Filtri';
import Budget from './Budget';
import Navbar from './Navbar';
import { ThemeProvider } from './ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <div className="theme-container">
      

        <Router>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/filtri" element={<Filtri />} />
            <Route path="/budget" element={<Budget />} />
          </Routes>
        </Router>
      </div>
    </ThemeProvider>
  );
}

export default App;
