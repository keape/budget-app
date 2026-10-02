import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const etichetta = (fotografia) => `${MESI[fotografia.mese]} ${String(fotografia.anno).slice(2)}`;

const euro = (valore) =>
  `€${Number(valore || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// Il grafico dell'andamento del Patrimonio si costruisce dalle Fotografie mensili: le
// uniche che sanno quanto valeva il patrimonio un mese fa. Comincia dal mese in cui la
// Fotografia ha iniziato a essere scritta, perché il passato non è ricostruibile.
function PatrimonioChart({ fotografie = [] }) {
  const dati = fotografie.map((f) => ({
    ...f,
    etichetta: etichetta(f)
  }));

  if (dati.length < 2) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          {dati.length === 0
            ? 'Il grafico comincia da questo mese: serve almeno una Fotografia, e la prima è stata appena scritta.'
            : 'Serve più di un mese di Fotografie per disegnare l\'andamento: il secondo punto arriva il mese prossimo.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">📈 Andamento del Patrimonio</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={dati} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="etichetta" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={euro} tick={{ fontSize: 12 }} width={70} />
          <Tooltip formatter={(valore) => euro(valore)} />
          <Legend />
          <Line type="monotone" dataKey="patrimonio" name="Patrimonio" stroke="#4f46e5" strokeWidth={2} dot={dati.length < 24} />
          <Line type="monotone" dataKey="attivita" name="Attività" stroke="#059669" strokeWidth={1} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {dati.length} {dati.length === 1 ? 'Fotografia' : 'Fotografie'}; l'ultima è quella del mese in corso e
        viene aggiornata finché il mese non chiude.
      </p>
    </div>
  );
}

export default PatrimonioChart;
