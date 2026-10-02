#!/usr/bin/env node
/*
 * Importa le entrate storiche che non sono mai arrivate nell'applicazione.
 *
 * Fonte: il foglio "Movimenti" di ~/Documents/Finanza/Analisi spese.xlsx, colonna
 * "Entrata/Uscita" = Entrata (quelle righe hanno importo positivo nel file).
 *
 * Le righe già presenti (stessa data, stessa categoria, stesso importo assoluto, in Entrate
 * o in Spese) vengono saltate: lo script è idempotente e si può rieseguire senza duplicare.
 * Le righe importate finiscono sul conto indicato da --voce (predefinito: il Conto
 * principale dell'utente, cioè la sua Attività di tipo Contanti/Conti correnti più vecchia).
 *
 * Uso:
 *   node scripts/importa-entrate-storiche.js <file.xlsx> <userId>            # prova
 *   node scripts/importa-entrate-storiche.js <file.xlsx> <userId> --conferma # esegue
 *   node scripts/importa-entrate-storiche.js <file.xlsx> <userId> --voce <voceId>
 *   node scripts/importa-entrate-storiche.js --rollback <file>               # annulla
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const Attivita = require('../models/Attivita');
const Componente = require('../models/Componente');
const { componentePredefinita } = require('../services/patrimonio');

const args = process.argv.slice(2);
const conferma = args.includes('--conferma');
const daRollback = args.indexOf('--rollback') !== -1 ? args[args.indexOf('--rollback') + 1] : null;
const indiceVoce = args.indexOf('--voce');
const voceScelta = indiceVoce !== -1 ? args[indiceVoce + 1] : null;
const posizionali = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--voce' && args[i - 1] !== '--rollback');
const [fileExcel, userId] = posizionali;

const arrotonda = (v) => Math.round((Number(v) || 0) * 100) / 100;
const giorno = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const chiave = (data, categoria, importo) => `${giorno(data)}|${String(categoria || '').trim()}|${arrotonda(Math.abs(importo))}`;

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI assente in server/.env');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  console.log('Database:', uri.replace(/\/\/[^@]*@/, '//***@').replace(/\?.*$/, ''));

  if (daRollback) {
    const dati = JSON.parse(fs.readFileSync(daRollback, 'utf8'));
    const esito = await Entrata.deleteMany({ _id: { $in: dati.create.map(String) } });
    console.log(`↩️  Rollback eseguito: ${esito.deletedCount} entrate eliminate`);
    await mongoose.connection.close();
    return;
  }

  if (!fileExcel || !userId) throw new Error('Servono il file Excel e lo userId: node scripts/importa-entrate-storiche.js <file.xlsx> <userId>');

  const wb = XLSX.readFile(fileExcel, { cellDates: true });
  const foglio = wb.SheetNames.includes('Movimenti') ? 'Movimenti' : wb.SheetNames[0];
  const righe = XLSX.utils.sheet_to_json(wb.Sheets[foglio], { raw: true })
    .map((r) => ({
      data: r.Data,
      categoria: String(r.Categoria || '').trim(),
      importo: Number(r.Importo),
      descrizione: r.Commenti || '',
      tipo: String(r['Entrata/Uscita'] || '')
    }))
    .filter((r) => isFinite(r.importo) && r.importo > 0 && r.data && r.categoria);
  console.log(`Foglio "${foglio}": ${righe.length} righe di entrata nel file`);

  const oid = new mongoose.Types.ObjectId(String(userId));
  const presenti = new Map();
  const aggiungi = async (Mod) => (await Mod.find({ userId: oid }).lean()).forEach((d) => {
    const k = chiave(d.data, d.categoria, d.importo);
    presenti.set(k, (presenti.get(k) || 0) + 1);
  });
  await aggiungi(Entrata);
  await aggiungi(Spesa);

  const daImportare = [];
  righe.forEach((r) => {
    const k = chiave(r.data, r.categoria, r.importo);
    const disponibili = presenti.get(k) || 0;
    if (disponibili > 0) { presenti.set(k, disponibili - 1); return; }
    daImportare.push(r);
  });

  const perAnno = new Map();
  daImportare.forEach((r) => {
    const a = new Date(r.data).getFullYear();
    const c = perAnno.get(a) || { n: 0, t: 0 };
    c.n++; c.t += r.importo; perAnno.set(a, c);
  });
  console.log(`\nDa importare: ${daImportare.length} righe, ${arrotonda(daImportare.reduce((a, r) => a + r.importo, 0))} €`);
  [...perAnno.entries()].sort().forEach(([a, c]) => console.log(`   ${a}: ${c.n} righe | ${arrotonda(c.t)} €`));
  console.log('   per categoria:', JSON.stringify(daImportare.reduce((acc, r) => { acc[r.categoria] = arrotonda((acc[r.categoria] || 0) + r.importo); return acc; }, {})));
  if (daImportare.length === 0) {
    console.log('\n✅ Niente da importare: tutte le righe del file sono già in archivio.');
    await mongoose.connection.close();
    return;
  }

  // Il conto che riceve: quello indicato, altrimenti la prima Attività di tipo denaro.
  const voci = await Attivita.find({ userId: oid }).lean();
  const voce = voceScelta
    ? voci.find((v) => String(v._id) === String(voceScelta))
    : voci.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
  if (!voce) throw new Error('Nessuna Voce patrimoniale per questo utente');
  const componente = await componentePredefinita(oid, 'attivita', voce._id);
  console.log(`\nConto che riceve: "${voce.nome}" (${voce._id}) — componente ${componente._id}`);

  if (!conferma) {
    console.log('\nPROVA (non ho scritto nulla). Prime righe:');
    daImportare.slice(0, 10).forEach((r) => console.log(`   ${giorno(r.data)} | ${r.categoria} | ${arrotonda(r.importo)} € | ${String(r.descrizione).slice(0, 40)}`));
    console.log('Per eseguire: --conferma');
    await mongoose.connection.close();
    return;
  }

  const create = [];
  for (const r of daImportare) {
    const d = await Entrata.create({
      userId: oid,
      descrizione: r.descrizione,
      importo: Math.abs(r.importo),
      categoria: r.categoria,
      data: r.data,
      voceSpecie: 'attivita',
      voceId: voce._id,
      componenteId: componente._id
    });
    create.push(d._id);
  }
  const file = path.join(__dirname, `rollback-entrate-storiche-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ quando: new Date().toISOString(), userId: String(oid), conto: voce.nome, create }, null, 1), 'utf8');
  console.log(`\n✅ Importate ${create.length} entrate su "${voce.nome}"`);
  console.log(`   File di rollback: ${file}`);
  console.log(`   Per annullare: node scripts/importa-entrate-storiche.js --rollback ${path.basename(file)}`);
  await mongoose.connection.close();
})().catch(async (err) => {
  console.error('ERRORE:', err.message);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
