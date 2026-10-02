import React from 'react';
import PatrimonioChart from './PatrimonioChart';

// Il blocco centrale della Home: quanto vale il patrimonio, come si divide nei tre gruppi
// (Denaro, Beni, Debiti), il grafico che nasce dalle Fotografie mensili e da dove vengono
// i numeri. Il lessico è quello del glossario: Voce patrimoniale, Attività, Debito.
function PatrimonioRiepilogo({ patrimonio, gruppi, fotografie = [], onApri }) {
  const denaro = gruppi?.denaro || { totale: 0, voci: [] };
  const beni = gruppi?.beni || { totale: 0, voci: [] };
  const debiti = gruppi?.debiti || { totale: 0, voci: [] };

  const euro = (valore) =>
    `€${Number(valore || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const Gruppo = ({ titolo, icona, dati, colore, vuoto }) => (
    <div className={`p-4 rounded-lg border-l-4 ${colore}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-800 dark:text-white">
          {icona} {titolo}
        </span>
        <span className="font-bold text-gray-800 dark:text-white">{euro(dati.totale)}</span>
      </div>
      {dati.voci.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {dati.voci.map((voce) => (
            <li key={String(voce.id)} className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>
                {voce.nome}
                {voce.tipo ? <span className="text-gray-400 dark:text-gray-500"> · {voce.tipo.nome}</span> : null}
              </span>
              <span>{euro(voce.valore)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 italic">{vuoto}</p>
      )}
    </div>
  );

  return (
    <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">💼 Patrimonio</h2>
        <button
          onClick={onApri}
          className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Gestisci conti e trasferimenti →
        </button>
      </div>

      <div className="text-center mb-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Patrimonio complessivo</p>
        <p className={`text-4xl font-bold ${patrimonio >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
          {euro(patrimonio)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Gruppo
          titolo="Denaro"
          icona="💰"
          dati={denaro}
          colore="border-green-500 bg-green-50 dark:bg-green-900/20"
          vuoto="Nessun conto: creane uno in Gestisci conti."
        />
        <Gruppo
          titolo="Beni"
          icona="🏠"
          dati={beni}
          colore="border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          vuoto="Immobili, veicoli e beni di valore arrivano con la prossima fetta."
        />
        <Gruppo
          titolo="Debiti"
          icona="📉"
          dati={debiti}
          colore="border-red-500 bg-red-50 dark:bg-red-900/20"
          vuoto="Mutui, finanziamenti e carte arrivano con la prossima fetta."
        />
      </div>

      <p className="mt-4 mb-6 text-xs text-gray-500 dark:text-gray-400">
        Il patrimonio è la somma delle Attività meno i Debiti. Spese ed Entrate cambiano il denaro;
        i Trasferimenti spostano valore tra conti senza entrare nel budget.
      </p>

      {fotografie.length > 0 && <PatrimonioChart fotografie={fotografie} />}
    </div>
  );
}

export default PatrimonioRiepilogo;
