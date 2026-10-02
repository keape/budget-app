#!/usr/bin/env node
/*
 * Verifica del Patrimonio: confronta il valore che l'applicazione calcola con la somma
 * grezza dei Movimenti presenti nel database.
 *
 * Per ogni utente, il totale del gruppo Denaro deve essere uguale a
 * Σ Entrate + Σ Spese (+ Trasferimenti e Rettifiche, quando ci saranno): se i due numeri
 * divergono, c'è un Movimento che non finisce in nessun saldo.
 *
 * Uso: node scripts/verifica-patrimonio.js
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const Trasferimento = require('../models/Trasferimento');
const Rettifica = require('../models/Rettifica');
const patrimonioService = require('../services/patrimonio');

const arrotonda = (v) => Math.round((Number(v) || 0) * 100) / 100;

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI assente in server/.env');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  console.log('Database:', uri.replace(/\/\/[^@]*@/, '//***@').replace(/\?.*$/, ''));

  const orfani = {
    spese: await Spesa.countDocuments({ componenteId: null }),
    entrate: await Entrata.countDocuments({ componenteId: null })
  };
  console.log('Movimenti senza Componente (non entrerebbero in nessun saldo):', orfani);

  const utenti = new Set([
    ...(await Spesa.distinct('userId')).map(String),
    ...(await Entrata.distinct('userId')).map(String)
  ]);

  let controllati = 0;
  let divergenti = 0;
  let patrimonioTotale = 0;

  for (const userId of utenti) {
    const uid = new mongoose.Types.ObjectId(userId);
    const [spese, entrate, uscite, entrateTrasferite, rettifiche] = await Promise.all([
      Spesa.aggregate([{ $match: { userId: uid } }, { $group: { _id: null, t: { $sum: '$importo' } } }]),
      Entrata.aggregate([{ $match: { userId: uid } }, { $group: { _id: null, t: { $sum: '$importo' } } }]),
      Trasferimento.aggregate([{ $match: { userId: uid } }, { $group: { _id: null, t: { $sum: '$importo' } } }]),
      Trasferimento.aggregate([{ $match: { userId: uid, 'a.voceId': { $ne: null } } }, { $group: { _id: null, t: { $sum: '$importo' } } }]),
      Rettifica.aggregate([{ $match: { userId: uid } }, { $group: { _id: null, t: { $sum: '$importo' } } }])
    ]);
    const somma = (r) => (r.length ? r[0].t : 0);
    const atteso = arrotonda(somma(spese) + somma(entrate) - somma(uscite) + somma(entrateTrasferite) + somma(rettifiche));

    const dati = await patrimonioService.calcolaPatrimonio(userId);
    const calcolato = arrotonda(dati.gruppi.denaro.totale);
    patrimonioTotale += dati.patrimonio;

    controllati += 1;
    if (arrotonda(calcolato - atteso) !== 0) {
      divergenti += 1;
      console.log(`  ⚠️  utente ${userId}: calcolato ${calcolato} contro atteso ${atteso}`);
    }
  }

  console.log(`\nUtenti controllati: ${controllati}`);
  console.log(`Divergenze: ${divergenti}`);
  console.log(`Patrimonio complessivo (tutti gli utenti): ${arrotonda(patrimonioTotale)} €`);

  await mongoose.connection.close();
  process.exit(divergenti === 0 ? 0 : 1);
})().catch(async (err) => {
  console.error('ERRORE:', err.message);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
