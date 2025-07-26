import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const BudgetChart = ({ sortedData, tipoTransazione, meseCorrente, annoCorrente }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation Handler
  const handleBarClick = (data) => {
    // Check if data and data.categoria exist before navigating
    if (data && data.categoria) {
        const params = new URLSearchParams();
        params.append('categoria', data.categoria);
        if (meseCorrente === 0) {
          params.append('anno', annoCorrente.toString());
        } else {
          params.append('mese', (meseCorrente - 1).toString());
          params.append('anno', annoCorrente.toString());
        }
        navigate(`/filtri?${params.toString()}`);
    } else {
        console.warn('Tentativo di navigazione senza dati validi dalla barra del grafico:', data);
    }
  };

  if (!sortedData || sortedData.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={sortedData}>
          <XAxis 
            dataKey="categoria" 
            angle={-45} 
            textAnchor="end" 
            height={100} 
            interval={0} 
          />
          <YAxis />
          <Tooltip formatter={(value) => `${value.toFixed(2)} €`} />
          <Legend />
          <Bar 
            dataKey="budget" 
            fill="#3182ce" 
            name="Budget" 
            onClick={handleBarClick} 
            cursor="pointer" 
          />
          {tipoTransazione === 'tutte' ? (
            <>
              <Bar
                dataKey="importoSpese"
                fill="#ef4444"
                name="Spese"
                onClick={handleBarClick}
                cursor="pointer"
              />
              <Bar
                dataKey="importoEntrate"
                fill="#48bb78"
                name="Entrate"
                onClick={handleBarClick}
                cursor="pointer"
              />
            </>
          ) : (
            <Bar
              dataKey="importo"
              fill={tipoTransazione === 'entrate' ? '#48bb78' : '#ef4444'}
              name={tipoTransazione === 'entrate' ? 'Entrate' : 'Spese'}
              onClick={handleBarClick}
              cursor="pointer"
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BudgetChart;