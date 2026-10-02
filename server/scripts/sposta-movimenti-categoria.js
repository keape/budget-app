#!/usr/bin/env node
/*
 * Sposta i Movimenti che stanno nella collezione sbagliata.
 *
 * Il criterio delle categorie di ENTRATA viene dal foglio "Movimenti" di
 * ~/Documents/Finanza/Analisi spese.xlsx, che ha la colonna "Entrata/Uscita": le categorie
 * sotto sono entrate in TUTTE le righe del file, nessuna esclusa. Le altre sono spese.
 * L'app ne conosceva solo sette: mancavano Blablacar e Genitori, ed è per questo che le
 * loro righe erano finite fra le Spese (scripts/importExcel.js crea solo Spese).
 *
 * Fa due cose, per ogni documento:
 *   1. Spesa con categoria di entrata  -> diventa un'Entrata (importo positivo);
 *   2. Entrata con categoria di spesa  -> diventa una Spesa (importo negativo).
 * In entrambi i casi conserva data, descrizione, categoria, conto e componente: cambia
 * solo la collezione, quindi il saldo del conto cambia di due volte l'importo.
 *
 * Uso:
 *   node scripts/sposta-movimenti-categoria.js                    # prova: elenca e non scrive
 *   node scripts/sposta-movimenti-categoria.js --conferma         # esegue
 *   node scripts/sposta-movimenti-categoria.js --rollback <file>  # annulla (file prodotto)
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const CategoryIcon = require('../models/CategoryIcon');

// Dal foglio "Movimenti" di Analisi spese.xlsx (colonna Entrata/Uscita).
const CATEGORIE_ENTRATA = [
  'Altra entrata', 'Blablacar', 'Consulenze', 'Genitori', 'Interessi', 'MBO', 'Stipendio', 'Ticket', 'Welfare'
];

const args = process.argv.slice(2);
const conferma = args.includes('--conferma');
const soloSpese = args.includes('--solo-spese');
const daRollback = args.indexOf('--rollback') !== -1 ? args[args.indexOf('--rollback') + 1] : null;

const arrotonda = (v) => Math.round((Number(v) || 0) * 100) / 100;
const normalizza = (s) => String(s || '').trim();
const eEntrata = (categoria) => CATEGORIE_ENTRATA.some((c) => c.toLowerCase() === normalizza(categoria).toLowerCase());

// Categorie configurate come spesa da ciascun utente (dalle icone di categoria).
async function categorieSpesaPerUtente() {
  const icone = await CategoryIcon.find({}).lean();
  const perUtente = new Map();
  icone.forEach((i) => {
    if (!String(i.tipo).toLowerCase().startsWith('spes')) return;
    const chiave = String(i.userId);
    if (!perUtente.has(chiave)) perUtente.set(chiave, new Set());
    perUtente.get(chiave).add(normalizza(i.categoria).toLowerCase());
  });
  return perUtente;
}

function campiComuni(d) {
  return {
    userId: d.userId,
    descrizione: d.descrizione,
    categoria: d.categoria,
    data: d.data,
    voceSpecie: d.voceSpecie,
    voceId: d.voceId,
    componenteId: d.componenteId
  };
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI assente in server/.env');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  console.log('Database:', uri.replace(/\/\/[^@]*@/, '//***@').replace(/\?.*$/, ''));

  if (daRollback) {
    const dati = JSON.parse(fs.readFileSync(daRollback, 'utf8'));
    let spese = 0, entrate = 0;
    for (const op of dati.operazioni) {
      if (op.tipo === 'spesa_a_entrata') {
        await Entrata.deleteOne({ _id: op.creatoId });
        await Spesa.create(op.originale);
        spese += 1;
      } else {
        await Spesa.deleteOne({ _id: op.creatoId });
        await Entrata.create(op.originale);
        entrate += 1;
      }
    }
    console.log(`↩️  Rollback eseguito: ${spese} documenti tornati in Spese, ${entrate} in Entrate`);
    await mongoose.connection.close();
    return;
  }

  const daSpostare = (await Spesa.find({}).lean()).filter((d) => eEntrata(d.categoria));
  const categorieSpesa = await categorieSpesaPerUtente();
  const entrateFuoriPosto = soloSpese ? [] : (await Entrata.find({}).lean()).filter((d) => {
    if (eEntrata(d.categoria)) return false;
    const suo = categorieSpesa.get(String(d.userId));
    return suo ? suo.has(normalizza(d.categoria).toLowerCase()) : false;
  });
  if (soloSpese) console.log('(--solo-spese: le Entrate con categoria di spesa restano dove sono)');

  const sommaSpese = arrotonda(daSpostare.reduce((a, d) => a + d.importo, 0));
  const sommaEntrate = arrotonda(entrateFuoriPosto.reduce((a, d) => a + d.importo, 0));
  console.log(`\nSpese con categoria di entrata: ${daSpostare.length} documenti, ${sommaSpese} €`);
  console.log(`Entrate con categoria di spesa: ${entrateFuoriPosto.length} documenti, ${sommaEntrate} €`);
  console.log(`Effetto sul patrimonio: ${arrotonda(-2 * sommaSpese - 2 * sommaEntrate)} €`);

  const perCategoria = new Map();
  daSpostare.forEach((d) => {
    const c = perCategoria.get(d.categoria) || { n: 0, t: 0 };
    c.n += 1; c.t = arrotonda(c.t + d.importo); perCategoria.set(d.categoria, c);
  });
  perCategoria.forEach((c, cat) => console.log(`   -> in Entrate: ${cat}: ${c.n} doc, ${c.t} €`));
  entrateFuoriPosto.forEach((d) => console.log(`   -> in Spese: ${d.categoria}: ${d.importo} € (${d.data?.toISOString?.().slice(0, 10)})`));

  if (daSpostare.length === 0 && entrateFuoriPosto.length === 0) {
    console.log('\n✅ Niente da spostare: ogni movimento è nella collezione giusta.');
    await mongoose.connection.close();
    return;
  }

  if (!conferma) {
    console.log('\nPROVA (non ho scritto nulla). Per eseguire: --conferma');
    await mongoose.connection.close();
    return;
  }

  const operazioni = [];
  for (const d of daSpostare) {
    const creata = await Entrata.create({ ...campiComuni(d), importo: Math.abs(d.importo) });
    await Spesa.deleteOne({ _id: d._id });
    operazioni.push({ tipo: 'spesa_a_entrata', creatoId: creata._id, originale: d });
  }
  for (const d of entrateFuoriPosto) {
    const creata = await Spesa.create({ ...campiComuni(d), importo: -Math.abs(d.importo) });
    await Entrata.deleteOne({ _id: d._id });
    operazioni.push({ tipo: 'entrata_a_spesa', creatoId: creata._id, originale: d });
  }

  const file = path.join(__dirname, `rollback-spostamento-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ quando: new Date().toISOString(), categorieEntrata: CATEGORIE_ENTRATA, operazioni }, null, 1), 'utf8');

  console.log(`\n✅ Spostati ${daSpostare.length} documenti in Entrate e ${entrateFuoriPosto.length} in Spese`);
  console.log(`   File di rollback: ${file}`);
  console.log(`   Per annullare: node scripts/sposta-movimenti-categoria.js --rollback ${path.basename(file)}`);
  console.log(`   Controllo: Spese con categoria di entrata = ${(await Spesa.find({}).lean()).filter((d) => eEntrata(d.categoria)).length} (deve essere 0)`);

  await mongoose.connection.close();
})().catch(async (err) => {
  console.error('ERRORE:', err.message);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
