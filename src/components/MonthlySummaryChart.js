import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';

const MonthlySummaryChart = ({ 
  totaleSpeseMese, 
  totaleEntrateMese, 
  bilancioMese,
  budgetSpeseMese = 0,
  budgetEntrateMese = 0 
}) => {
  
  // Calcola il budget bilancio previsto (entrate previste - spese previste)
  const budgetBilancio = budgetEntrateMese - budgetSpeseMese;
  
  // Calcola gli scostamenti
  // Per le spese: se spendo meno del budget, ho PIÙ margine disponibile (positivo)
  const scostamentoSpese = budgetSpeseMese - totaleSpeseMese; // Invertito: budget - effettivo
  const scostamentoEntrate = totaleEntrateMese - budgetEntrateMese;
  const scostamentoBilancio = bilancioMese - budgetBilancio;

  // Preparazione dati per il grafico
  const chartData = [
    {
      categoria: 'Entrate',
      effettivo: totaleEntrateMese,
      budget: budgetEntrateMese,
      scostamento: scostamentoEntrate,
      percentuale: budgetEntrateMese > 0 ? ((scostamentoEntrate / budgetEntrateMese) * 100) : 0
    },
    {
      categoria: 'Spese',
      effettivo: totaleSpeseMese,
      budget: budgetSpeseMese,
      scostamento: scostamentoSpese,
      percentuale: budgetSpeseMese > 0 ? ((scostamentoSpese / budgetSpeseMese) * 100) : 0
    },
    {
      categoria: 'Bilancio',
      effettivo: bilancioMese,
      budget: budgetBilancio,
      scostamento: scostamentoBilancio,
      percentuale: budgetBilancio !== 0 ? ((scostamentoBilancio / Math.abs(budgetBilancio)) * 100) : 0
    }
  ];

  // Custom tooltip per mostrare più informazioni
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600">
          <h3 className="font-bold text-gray-800 dark:text-white mb-2">{label}</h3>
          <div className="space-y-1">
            <p className="text-blue-600 dark:text-blue-400">
              <span className="font-semibold">Budget:</span> €{data.budget.toFixed(2)}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-semibold">Effettivo:</span> €{data.effettivo.toFixed(2)}
            </p>
            <p className={`font-semibold ${data.scostamento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <span>{data.categoria === 'Spese' ? 'Margine disponibile:' : 'Scostamento:'}</span> {data.scostamento >= 0 ? '+' : ''}€{data.scostamento.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ({data.percentuale >= 0 ? '+' : ''}{data.percentuale.toFixed(1)}%)
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Se non ci sono dati di budget, mostra solo il grafico base
  if (budgetSpeseMese === 0 && budgetEntrateMese === 0) {
    const simpleData = [
      { categoria: 'Entrate', valore: totaleEntrateMese },
      { categoria: 'Spese', valore: totaleSpeseMese },
      { categoria: 'Bilancio', valore: bilancioMese }
    ];

    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center">
          <span className="mr-2">📊</span>
          Riepilogo Finanziario Mensile
        </h3>
        <div className="mb-2">
          <p className="text-sm text-gray-600 dark:text-gray-400 italic">
            Nessun budget configurato. Configura il budget per vedere l'analisi degli scostamenti.
          </p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={simpleData}>
            <XAxis dataKey="categoria" />
            <YAxis tickFormatter={(value) => `€${value.toFixed(0)}`} />
            <Tooltip formatter={(value) => [`€${value.toFixed(2)}`, '']} />
            <Bar
              dataKey="valore"
              fill={(entry) => {
                if (entry.categoria === 'Entrate') return '#059669';
                if (entry.categoria === 'Spese') return '#DC2626';
                return entry.valore >= 0 ? '#3B82F6' : '#F59E0B';
              }}
              name="Importo"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
      <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center">
        <span className="mr-2">📊</span>
        Andamento vs Budget Mensile
      </h3>
      
      {/* Indicatori di stato sopra il grafico */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className={`text-sm font-medium ${scostamentoSpese >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {scostamentoSpese >= 0 ? 'Margine disponibile' : 'Budget superato'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {scostamentoSpese >= 0 ? '+' : ''}€{scostamentoSpese.toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className={`text-sm font-medium ${scostamentoEntrate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            Entrate {scostamentoEntrate >= 0 ? 'sopra' : 'sotto'} previsioni
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {scostamentoEntrate >= 0 ? '+' : ''}€{scostamentoEntrate.toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className={`text-sm font-medium ${scostamentoBilancio >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            Bilancio {scostamentoBilancio >= 0 ? 'migliore' : 'peggiore'} del previsto
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {scostamentoBilancio >= 0 ? '+' : ''}€{scostamentoBilancio.toFixed(2)}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={chartData}>
          <XAxis dataKey="categoria" />
          <YAxis tickFormatter={(value) => `€${value.toFixed(0)}`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Linea di riferimento a zero per il bilancio */}
          <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />
          
          {/* Barre per budget e valori effettivi */}
          <Bar dataKey="budget" fill="#93C5FD" name="Budget" opacity={0.7} />
          <Bar 
            dataKey="effettivo" 
            fill="#3B82F6" 
            name="Effettivo"
          />
          
          {/* Linea per gli scostamenti */}
          <Line 
            type="monotone" 
            dataKey="scostamento" 
            stroke="#F59E0B" 
            strokeWidth={3}
            name="Scostamento"
            dot={{ fill: '#F59E0B', strokeWidth: 2, r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legenda estesa */}
      <div className="mt-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <p><span className="font-semibold">Budget:</span> Importo pianificato per il mese</p>
        <p><span className="font-semibold">Effettivo:</span> Importo reale delle transazioni</p>
        <p><span className="font-semibold">Scostamento:</span> Differenza tra effettivo e budget</p>
        <div className="flex items-center space-x-4 mt-2">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
            <span>Positivo (meglio del budget)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded mr-1"></div>
            <span>Negativo (peggio del budget)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlySummaryChart;