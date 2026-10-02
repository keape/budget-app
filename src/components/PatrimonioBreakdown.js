import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useTheme } from '../ThemeContext';
import { euro, euroCompatto } from '../utils/patrimonioFormat';

// La vista a blocchi del Patrimonio: un blocco per Tipo, mese per mese (o anno per anno
// quando i mesi sono troppi per disegnarli tutti). Le Attività stanno sopra lo zero, i Debiti
// sotto: il vuoto in mezzo è il patrimonio, e non serve scriverlo.
//
// I colori non si scelgono qui: arrivano da `coloriPerTipo`, gli stessi della sintesi nella
// colonna accanto. Un Tipo ha un colore solo in tutta la pagina.

function SchedaMese({ active, payload, tipi }) {
  if (!active || !payload || !payload.length) return null;
  const barra = payload[0].payload;
  const conValore = tipi.filter((t) => Math.abs(barra.totali[t.chiave] || 0) >= 0.005);

  return (
    <div className="max-w-[16rem] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-500 dark:text-gray-400">{barra.etichettaLunga}</p>

      {conValore.map((tipo) => (
        <p key={tipo.chiave} className="mt-1 flex items-center gap-2 text-xs">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tipo.colore }} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-300">{tipo.nome}</span>
          <span className="tabular-nums text-gray-900 dark:text-white">{euro(barra.totali[tipo.chiave])}</span>
        </p>
      ))}

      <div className="mt-2 space-y-0.5 border-t border-gray-100 dark:border-gray-700 pt-2 text-xs">
        <p className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-gray-400">Attività</span>
          <span className="font-medium tabular-nums text-gray-900 dark:text-white">{euro(barra.totaleAttivita)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-gray-400">Debiti</span>
          <span className="font-medium tabular-nums text-rose-700 dark:text-rose-400">{euro(barra.totaleDebiti)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-gray-400">Patrimonio</span>
          <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{euro(barra.patrimonio)}</span>
        </p>
      </div>
    </div>
  );
}

// La legenda è dentro il grafico e non in fondo alla pagina: il blocco colorato e il suo nome
// devono stare a portata d'occhio insieme. Attività e Debiti restano due gruppi distinti.
function Legenda({ tipi }) {
  const attivita = tipi.filter((t) => !t.debito);
  const debiti = tipi.filter((t) => t.debito);
  const gruppi = [
    { titolo: 'Attività', voci: attivita },
    { titolo: 'Debiti', voci: debiti }
  ].filter((g) => g.voci.length);

  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {gruppi.map((gruppo, i) => (
        <li key={gruppo.titolo} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${i > 0 ? 'sm:border-l sm:border-gray-200 sm:dark:border-gray-800 sm:pl-4' : ''}`}>
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{gruppo.titolo}</span>
          {gruppo.voci.map((tipo) => (
            <span key={tipo.chiave} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tipo.colore }} aria-hidden="true" />
              {tipo.nome}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

function PatrimonioBreakdown({ barre = [], tipi = [], perAnno = false, altezza = 240 }) {
  const { darkMode } = useTheme();

  const griglia = darkMode ? '#1f2937' : '#eef0f4';
  const testo = darkMode ? '#9ca3af' : '#6b7280';
  const zero = darkMode ? '#374151' : '#d1d5db';

  if (!barre.length) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Nessun mese da disegnare: registra un movimento su un conto e la prima barra compare qui.
      </p>
    );
  }

  const prima = barre[0];
  const ultima = barre[barre.length - 1];
  const descrizione = `Ripartizione del patrimonio per Tipo, da ${prima.etichettaLunga} a ${ultima.etichettaLunga}: attività ${euro(ultima.totaleAttivita)}, debiti ${euro(ultima.totaleDebiti)}.`;

  return (
    <div>
      <div style={{ width: '100%', height: altezza }} role="img" aria-label={descrizione}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barre} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset="sign">
            <CartesianGrid vertical={false} stroke={griglia} />
            <XAxis
              dataKey="etichetta"
              tick={{ fill: testo, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
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
            <ReferenceLine y={0} stroke={zero} />
            <Tooltip content={<SchedaMese tipi={tipi} />} cursor={{ fill: darkMode ? '#ffffff0d' : '#00000008' }} />
            {tipi.map((tipo) => (
              <Bar
                key={tipo.chiave}
                dataKey={`valori.${tipo.chiave}`}
                name={tipo.nome}
                stackId={tipo.debito ? 'debiti' : 'attivita'}
                fill={tipo.colore}
                maxBarSize={56}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Legenda tipi={tipi} />

      {perAnno && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Un anno per barra: la storia è troppo lunga per un mese alla volta. Ogni barra porta il valore
          dell'ultimo mese dell'anno.
        </p>
      )}
    </div>
  );
}

export default PatrimonioBreakdown;
