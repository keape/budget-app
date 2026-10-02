#!/usr/bin/env node
/*
 * Configura le categorie di ENTRATA che l'app non conosceva.
 *
 * La lista delle categorie mostrate dall'applicazione nasce dalle chiavi di `entrate` e
 * `spese` nei documenti di `budgetsettings_new` (vedi server/routes/categorie.js): una
 * categoria che non è in nessuna delle due non compare in nessun elenco, ed è per questo
 * che Blablacar e Genitori — entrate secondo il foglio "Movimenti" di Analisi spese.xlsx —
 * finivano fra le spese.
 *
 * Fa due cose:
 *   1. aggiunge la categoria alle chiavi di `entrate` (valore 0 = nessun obiettivo di
 *      budget) in tutti i documenti di budget dell'utente, senza toccare quelle esistenti;
 *   2. crea l'icona della categoria (tipo `entrate`) se manca.
 *
 * Uso:
 *   node scripts/configura-categorie-entrata.js <userId>            # prova
 *   node scripts/configura-categorie-entrata.js <userId> --conferma # esegue
 *   node scripts/configura-categorie-entrata.js --rollback <file>   # annulla
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const CategoryIcon = require('../models/CategoryIcon');

// Dal foglio "Movimenti" di Analisi spese.xlsx: entrate in tutte le righe del file.
const DA_AGGIUNGERE = [
  { categoria: 'Blablacar', icona: '🚗' },
  { categoria: 'Genitori', icona: '👪' }
];

const args = process.argv.slice(2);
const conferma = args.includes('--conferma');
const daRollback = args.indexOf('--rollback') !== -1 ? args[args.indexOf('--rollback') + 1] : null;
const userId = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--rollback')[0];

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI assente in server/.env');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  console.log('Database:', uri.replace(/\/\/[^@]*@/, '//***@').replace(/\?.*$/, ''));

  if (daRollback) {
    const dati = JSON.parse(fs.readFileSync(daRollback, 'utf8'));
    const budget = mongoose.connection.db.collection('budgetsettings_new');
    for (const doc of dati.budget) {
      const unset = {};
      doc.chiaviAggiunte.forEach((c) => { unset[`entrate.${c}`] = ''; });
      await budget.updateOne({ _id: new mongoose.Types.ObjectId(doc._id) }, { $unset: unset });
    }
    const esito = await CategoryIcon.deleteMany({ _id: { $in: dati.icone.map((i) => new mongoose.Types.ObjectId(i)) } });
    console.log(`↩️  Rollback eseguito: chiavi rimosse da ${dati.budget.length} documenti, ${esito.deletedCount} icone eliminate`);
    await mongoose.connection.close();
    return;
  }

  if (!userId) throw new Error('Serve lo userId: node scripts/configura-categorie-entrata.js <userId>');

  const oid = new mongoose.Types.ObjectId(String(userId));
  const budget = mongoose.connection.db.collection('budgetsettings_new');
  const docs = await budget.find({ $or: [{ userId: String(userId) }, { userId: oid }] }).toArray();
  console.log(`documenti di budget dell'utente: ${docs.length}`);

  const icone = await CategoryIcon.find({ userId: oid }).lean();
  const iconeEntrate = new Set(icone.filter((i) => i.tipo === 'entrate').map((i) => i.categoria.toLowerCase()));

  const daFare = [];
  const iconeDaCreare = [];
  DA_AGGIUNGERE.forEach(({ categoria, icona }) => {
    const chiave = categoria.toLowerCase();
    const conChiave = docs.filter((d) => Object.keys(d.entrate || {}).some((k) => k.toLowerCase() === chiave));
    if (conChiave.length === 0) daFare.push({ categoria, documenti: docs.length });
    else console.log(`   "${categoria}" è già una categoria di entrata in ${conChiave.length} documenti: nessun cambiamento`);
    if (!iconeEntrate.has(chiave)) iconeDaCreare.push({ categoria, icona });
  });

  console.log('\nDa aggiungere come categoria di entrata:', JSON.stringify(daFare));
  console.log('Icone da creare:', JSON.stringify(iconeDaCreare));
  if (daFare.length === 0 && iconeDaCreare.length === 0) {
    console.log('\n✅ Niente da fare.');
    await mongoose.connection.close();
    return;
  }

  if (!conferma) {
    console.log('\nPROVA (non ho scritto nulla). Per eseguire: --conferma');
    await mongoose.connection.close();
    return;
  }

  const registroBudget = [];
  for (const voce of daFare) {
    for (const d of docs) {
      await budget.updateOne({ _id: d._id }, { $set: { [`entrate.${voce.categoria}`]: 0 } });
    }
    registroBudget.push({ categoria: voce.categoria, documenti: docs.map((d) => String(d._id)) });
  }
  const iconeCreate = [];
  for (const i of iconeDaCreare) {
    const creata = await CategoryIcon.create({ userId: oid, tipo: 'entrate', categoria: i.categoria, icona: i.icona });
    iconeCreate.push(String(creata._id));
  }

  const file = path.join(__dirname, `rollback-categorie-entrata-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({
    quando: new Date().toISOString(),
    userId: String(oid),
    budget: registroBudget.map((r) => ({ _id: null, chiaviAggiunte: [r.categoria], documenti: r.documenti })).flatMap((r) => r.documenti.map((id) => ({ _id: id, chiaviAggiunte: r.chiaviAggiunte }))),
    icone: iconeCreate
  }, null, 1), 'utf8');

  console.log(`\n✅ Aggiunte ${daFare.length} categorie di entrata in ${docs.length} documenti di budget, ${iconeCreate.length} icone`);
  console.log(`   File di rollback: ${file}`);
  console.log(`   Per annullare: node scripts/configura-categorie-entrata.js --rollback ${path.basename(file)}`);
  await mongoose.connection.close();
})().catch(async (err) => {
  console.error('ERRORE:', err.message);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
