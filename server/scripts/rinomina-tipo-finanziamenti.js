#!/usr/bin/env node
/*
 * Rinomina il Tipo di voce "Finanziamenti" in "Debiti".
 *
 * Perché serve uno script e non basta il codice: il Tipo esiste in un catalogo per utente
 * (25 documenti, tutti con nome "Finanziamenti"), e `assicuraCatalogoTipi` reinserisce i
 * Tipi del catalogo che non trova per nome. Se si rinomina prima il catalogo in
 * models/TipoVoce.js, al primo accesso il servizio creerebbe un "Debiti" nuovo accanto ai
 * "Finanziamenti" esistenti: due tipi al posto di uno. Quindi: prima i dati, poi il codice.
 *
 * La rinomina non tocca l'_id, quindi nessun riferimento si spezza (le Voci puntano al Tipo
 * per _id, non per nome).
 *
 * Uso:
 *   node scripts/rinomina-tipo-finanziamenti.js                     # prova: conta e non scrive
 *   node scripts/rinomina-tipo-finanziamenti.js --conferma          # esegue
 *   node scripts/rinomina-tipo-finanziamenti.js --rollback <file>   # annulla (file prodotto)
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const TipoVoce = require('../models/TipoVoce');

const NOME_VECCHIO = 'Finanziamenti';
const NOME_NUOVO = 'Debiti';

const args = process.argv.slice(2);
const conferma = args.includes('--conferma');
const daRollback = args.indexOf('--rollback') !== -1 ? args[args.indexOf('--rollback') + 1] : null;

async function rollback(file) {
  const dati = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ids = dati.rinominati.map((r) => r._id);
  const esistenti = await TipoVoce.find({ _id: { $in: ids } });
  if (esistenti.length !== ids.length) {
    throw new Error(`Il file di rollback cita ${ids.length} Tipi ma in archivio ne esistono ${esistenti.length}`);
  }
  // Se un Tipo si chiama già "Finanziamenti" la rinomina violerebbe l'indice unico {userId, nome}.
  const conflitti = await TipoVoce.countDocuments({ nome: NOME_VECCHIO, _id: { $nin: ids } });
  if (conflitti > 0) throw new Error(`Ci sono già ${conflitti} Tipi chiamati "${NOME_VECCHIO}": rollback interrotto`);

  for (const id of ids) {
    await TipoVoce.updateOne({ _id: id }, { $set: { nome: NOME_VECCHIO } });
  }
  console.log(`↩️  Rollback eseguito: ${ids.length} Tipi tornati a "${NOME_VECCHIO}"`);
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI assente in server/.env');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  console.log('Database:', uri.replace(/\/\/[^@]*@/, '//***@').replace(/\?.*$/, ''));

  if (daRollback) {
    await rollback(daRollback);
    await mongoose.connection.close();
    return;
  }

  const daRinominare = await TipoVoce.find({ nome: NOME_VECCHIO }).lean();
  const giaNuovi = await TipoVoce.countDocuments({ nome: NOME_NUOVO });
  const utenti = new Set(daRinominare.map((t) => String(t.userId)));

  console.log(`Tipi "${NOME_VECCHIO}": ${daRinominare.length} (${utenti.size} utenti)`);
  console.log(`Tipi già chiamati "${NOME_NUOVO}": ${giaNuovi}`);
  const debiti = daRinominare.filter((t) => t.specie !== 'debito');
  if (debiti.length > 0) throw new Error(`Ci sono ${debiti.length} Tipi "${NOME_VECCHIO}" che non sono di specie debito: interrotto`);

  if (giaNuovi > 0) {
    console.log(`⚠️  Ci sono già ${giaNuovi} Tipi "${NOME_NUOVO}": la rinomina violerebbe l'indice unico {userId, nome}. Interrotto.`);
    await mongoose.connection.close();
    return;
  }

  if (daRinominare.length === 0) {
    console.log('✅ Niente da fare: nessun Tipo da rinominare.');
    await mongoose.connection.close();
    return;
  }

  if (!conferma) {
    console.log('\nPROVA (non ho scritto nulla). Per eseguire: --conferma');
    daRinominare.forEach((t) => console.log(`   utente ${String(t.userId).slice(-6)} | ${t._id} | ${t.nome} → ${NOME_NUOVO}`));
    await mongoose.connection.close();
    return;
  }

  const fileRollback = path.join(__dirname, `rollback-rinomina-finanziamenti-${Date.now()}.json`);
  fs.writeFileSync(fileRollback, JSON.stringify({
    quando: new Date().toISOString(),
    da: NOME_VECCHIO,
    a: NOME_NUOVO,
    rinominati: daRinominare.map((t) => ({ _id: t._id, userId: t.userId, nomePrecedente: t.nome }))
  }, null, 2), 'utf8');

  const esito = await TipoVoce.updateMany(
    { _id: { $in: daRinominare.map((t) => t._id) } },
    { $set: { nome: NOME_NUOVO } }
  );
  console.log(`\n✅ Rinominati ${esito.modifiedCount} Tipi in "${NOME_NUOVO}"`);
  console.log(`   File di rollback: ${fileRollback}`);
  console.log(`   Per annullare: node scripts/rinomina-tipo-finanziamenti.js --rollback ${path.basename(fileRollback)}`);

  const rimasti = await TipoVoce.countDocuments({ nome: NOME_VECCHIO });
  const nuovi = await TipoVoce.countDocuments({ nome: NOME_NUOVO });
  console.log(`   Controllo: "${NOME_VECCHIO}"=${rimasti} (deve essere 0), "${NOME_NUOVO}"=${nuovi} (${utenti.size} utenti)`);

  await mongoose.connection.close();
})().catch(async (err) => {
  console.error('ERRORE:', err.message);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
