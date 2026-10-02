import React, { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useTheme } from '../ThemeContext';
import { euro, euroCompatto, etichettaMese, etichettaMeseLungo } from '../utils/patrimonioFormat';

// Il grafico di una serie mensile: patrimonio complessivo (dalle Fotografie) o valore di un
// singolo conto (dai suoi Movimenti). Nessuna griglia verticale, nessuna legenda: la serie è
// una sola e il numero è già scritto sopra il grafico.
function SchedaMese({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const punto = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-500 dark:text-gray-400">{etichettaMeseLungo(punto.chiave)}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{euro(punto.valore)}</p>
    </div>
  );
}

function SerieChart({ punti = [], colore = '#6366f1', altezza = 240, nome = 'Valore' }) {
  const { darkMode } = useTheme();
  const gradiente = useId().replace(/[:]/g, '');

  const griglia = darkMode ? '#1f2937' : '#eef0f4';
  const testo = darkMode ? '#9ca3af' : '#6b7280';

  return (
    <div style={{ width: '100%', height: altezza }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={punti} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`area-${gradiente}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colore} stopOpacity={0.28} />
              <stop offset="100%" stopColor={colore} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={griglia} />
          <XAxis
            dataKey="chiave"
            tickFormatter={etichettaMese}
            tick={{ fill: testo, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={44}
            tickMargin={10}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={euroCompatto}
            tick={{ fill: testo, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={62}
          />
          <Tooltip content={<SchedaMese />} cursor={{ stroke: testo, strokeDasharray: '3 3' }} />
          <Area
            type="monotone"
            dataKey="valore"
            name={nome}
            stroke={colore}
            strokeWidth={2}
            fill={`url(#area-${gradiente})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SerieChart;
