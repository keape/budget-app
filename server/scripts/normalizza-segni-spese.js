#!/usr/bin/env node
/*
 * Normalizza il segno dei Movimenti: Spesa sempre negativa, Entrata sempre positiva.
 *
 * È la regola delle rotte (routes/spese.js e routes/entrate.js, `-Math.abs` / `Math.abs`).
 * I documenti con il segno sbagliato sono entrati per altre vie: in particolare
 * scripts/importExcel.js, che scriveva le Spese in positivo. Il motore del Patrimonio somma
 * gli importi così come sono in archivio, quindi una Spesa positiva **alza** il saldo del
 * conto invece di abbassarlo.
 *
 * Effetto: per ogni Spesa positiva il totale delle Spese scende di 2 volte il suo importo
 * (da +x a -x), e il Patrimonio con esso.
 *
 * Uso:
 *   node scripts/normalizza-segni-spese.js                    # prova: conta e non scrive
 *   node scripts/normalizza-segni-spese.js --conferma         # esegue
 *   node scripts/normalizza-segni-spese.js --rollback <file>  # annulla (file prodotto)
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');

const args = process.argv.slice(2);
const conferma = args.includes('--conferma');
const daRollback = args.indexOf('--rollback') !== -1 ? args[args.indexOf('--rollback') + 1] : null;

const arrotonda = (v) => Math.round((Number(v) || 0) * 100) / 100;
const riepilogo = (r) => (r.length ? { n: r[0].n, t: arrotonda(r[0].t) } : { n: 0, t: 0 });
const conta = (Mod, filtro) =>
  Mod.aggregate([{ $match: filtro }, { $group: { _id: null, n: { $sum: 1 }, t: { $sum: '$importo' } } }]).then(riepilogo);

// Scrive a blocchi: sono migliaia di documenti e un bulkWrite unico sarebbe troppo grande.
// Il file di rollback è JSON-lines compatto: una riga per collezione, rileggibile cosi com'è.
async function normalizza(Mod, filtro, trasforma, fileRollback) {
  const documenti = await Mod.find(filtro, { importo: 1 }).lean();
  if (documenti.length === 0) return 0;
  for (let i = 0; i < documenti.length; i += 500) {
    const blocco = documenti.slice(i, i + 500);
    await Mod.bulkWrite(
      blocco.map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $set: { importo: trasforma(d.importo) } } } })),
      { ordered: true }
    );
  }
  fs.appendFileSync(fileRollback, JSON.stringify({
    collezione: Mod.modelName,
    documenti: documenti.map((d) => ({ _id: d._id, importoPrecedente: d.importo }))
  }) + '\n', 'utf8');
  return documenti.length;
}

// Legge il file di rollback anche se è stato scritto indentato su più righe (formato usato
// dalla prima esecuzione): separa gli oggetti contando le graffe, fuori dalle stringhe.
function leggiRollback(percorso) {
  const testo = fs.readFileSync(percorso, 'utf8');
  // Caso normale: una riga per oggetto.
  const righe = testo.trim().split('\n').filter((r) => r.trim());
  if (righe.every((r) => { try { JSON.parse(r); return true; } catch (_) { return false; } })) {
    return righe.map((r) => JSON.parse(r));
  }
  const oggetti = [];
  let profondita = 0, inizio = -1, inStringa = false, escape = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (inStringa) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inStringa = false;
      continue;
    }
    if (c === '"') inStringa = true;
    else if (c === '{') { if (profondita === 0) inizio = i; profondita++; }
    else if (c === '}') {
      profondita--;
      if (profondita === 0 && inizio >= 0) { oggetti.push(JSON.parse(testo.slice(inizio, i + 1))); inizio = -1; }
    }
  }
  return oggetti;
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI assente in server/.env');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  console.log('Database:', uri.replace(/\/\/[^@]*@/, '//***@').replace(/\?.*$/, ''));

  if (daRollback) {
    const righe = leggiRollback(daRollback);
    let ripristinati = 0;
    for (const riga of righe) {
      const Mod = riga.collezione === 'Entrata' ? Entrata : Spesa;
      for (let i = 0; i < riga.documenti.length; i += 500) {
        const blocco = riga.documenti.slice(i, i + 500);
        const esito = await Mod.bulkWrite(
          blocco.map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $set: { importo: d.importoPrecedente } } } })),
          { ordered: true }
        );
        ripristinati += esito.modifiedCount;
      }
    }
    console.log(`↩️  Rollback eseguito: ${ripristinati} documenti riportati all'importo precedente`);
    await mongoose.connection.close();
    return;
  }

  const spesePositive = await conta(Spesa, { importo: { $gt: 0 } });
  const speseNegative = await conta(Spesa, { importo: { $lt: 0 } });
  const entrateNegative = await conta(Entrata, { importo: { $lt: 0 } });
  const entratePositive = await conta(Entrata, { importo: { $gt: 0 } });

  console.log(`\nSPESE  positive: ${spesePositive.n} (${spesePositive.t} €)  |  negative: ${speseNegative.n} (${speseNegative.t} €)`);
  console.log(`ENTRATE positive: ${entratePositive.n} (${entratePositive.t} €)  |  negative: ${entrateNegative.n} (${entrateNegative.t} €)`);
  console.log(`Totale Spese da ${arrotonda(spesePositive.t + speseNegative.t)} € a ${arrotonda(speseNegative.t - spesePositive.t)} €`);
  console.log(`Totale Entrate da ${arrotonda(entratePositive.t + entrateNegative.t)} € a ${arrotonda(entratePositive.t + Math.abs(entrateNegative.t))} €`);

  if (spesePositive.n > 0) {
    const perCategoria = await Spesa.aggregate([
      { $match: { importo: { $gt: 0 } } },
      { $group: { _id: '$categoria', n: { $sum: 1 }, t: { $sum: '$importo' } } },
      { $sort: { t: -1 } }
    ]);
    console.log('  categorie coinvolte:', perCategoria.map((c) => `${c._id} (${c.n})`).join(', '));
  }

  if (spesePositive.n === 0 && entrateNegative.n === 0) {
    console.log('\n✅ Niente da fare: i segni sono già a posto.');
    await mongoose.connection.close();
    return;
  }

  if (!conferma) {
    console.log('\nPROVA (non ho scritto nulla). Per eseguire: --conferma');
    await mongoose.connection.close();
    return;
  }

  const fileRollback = path.join(__dirname, `rollback-segni-${Date.now()}.jsonl`);
  fs.writeFileSync(fileRollback, '', 'utf8');
  const nSpese = await normalizza(Spesa, { importo: { $gt: 0 } }, (v) => -Math.abs(v), fileRollback);
  const nEntrate = await normalizza(Entrata, { importo: { $lt: 0 } }, (v) => Math.abs(v), fileRollback);

  console.log(`\n✅ Normalizzate ${nSpese} Spese e ${nEntrate} Entrate`);
  console.log(`   File di rollback: ${fileRollback}`);
  console.log(`   Per annullare: node scripts/normalizza-segni-spese.js --rollback ${path.basename(fileRollback)}`);

  const dopoP = await conta(Spesa, { importo: { $gt: 0 } });
  const dopoN = await conta(Spesa, { importo: { $lt: 0 } });
  const dopoEN = await conta(Entrata, { importo: { $lt: 0 } });
  console.log(`   Controllo: Spese positive=${dopoP.n} (devono essere 0), Entrate negative=${dopoEN.n} (devono essere 0), Spese totali=${arrotonda(dopoN.t)} €`);

  await mongoose.connection.close();
})().catch(async (err) => {
  console.error('ERRORE:', err.message);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
