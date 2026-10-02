import React from 'react';

// La traccia accanto al conto: la forma della sua storia, senza assi, senza numeri e senza
// interazione. Serve a riconoscere a colpo d'occhio un conto che sale da uno che scende; il
// valore esatto è scritto nella colonna accanto.
const percorso = (valori, larghezza, altezza) => {
  const margine = 3;
  const minimo = Math.min(...valori);
  const massimo = Math.max(...valori);
  const intervallo = massimo - minimo || 1;
  const passo = valori.length > 1 ? (larghezza - margine * 2) / (valori.length - 1) : 0;

  return valori
    .map((valore, i) => {
      const x = margine + i * passo;
      const y = altezza - margine - ((valore - minimo) / intervallo) * (altezza - margine * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
};

function Sparkline({ valori = [], larghezza = 88, altezza = 28, colore = 'currentColor' }) {
  // Con meno di due punti non esiste una forma da disegnare: un trattino dice la verità
  // meglio di una linea piatta inventata.
  if (!valori || valori.length < 2) {
    return <div className="h-[2px] w-16 rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />;
  }

  return (
    <svg
      width={larghezza}
      height={altezza}
      viewBox={`0 0 ${larghezza} ${altezza}`}
      className="text-gray-500 dark:text-gray-400"
      aria-hidden="true"
      focusable="false"
    >
      <path d={percorso(valori, larghezza, altezza)} fill="none" stroke={colore} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default Sparkline;
