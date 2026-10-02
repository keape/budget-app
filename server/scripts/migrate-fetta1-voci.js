#!/usr/bin/env node
/*
 * Fetta 1 — migrazione dei movimenti storici al Conto principale.
 *
 * Fa tre cose, per ogni utente che ha già dei movimenti:
 *   1. crea il catalogo dei Tipi di voce (i 10 iniziali) se non esiste;
 *   2. crea il Conto principale (Attività di tipo Conti correnti) con la sua Componente;
 *   3. assegna Voce e Componente a tutte le Spese e le Entrate che non ne hanno, e la Voce
 *      alle Transazioni periodiche attive.
 *
 * È idempotente: tocca solo i documenti che non hanno ancora la Voce. Non cancella nulla
 * e non modifica gli importi.
 *
 * Uso:
 *   node scripts/migrate-fetta1-voci.js                 # prova: conta e non scrive
 *   node scripts/migrate-fetta1-voci.js --conferma      # esegue la migrazione
 *   node scripts/migrate-fetta1-voci.js --rollback <file>   # annulla (usa il file prodotto)
 *
 * Viene scritto un file di rollback in server/scripts/rollback-fetta1-<data>.json con gli
 * identificativi toccati e gli identificativi creatati: l'operazione resta reversibile.
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const TipoVoce = require('../models/TipoVoce');
const Attivita = require('../models/Attivita');
const Componente = require('../models/Componente');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const TransazionePeriodica = require('../models/TransazionePeriodica');

const args = process.argv.slice(2);
const conferma = args.includes('--conferma');
const daRollback = args.indexOf('--rollback') !== -1 ? args[args.indexOf('--rollback') + 1] : null;

const catalogoTipi = TipoVoce.CATALOGO_INIZIALE;

async function utentiConDati() {
  const [daSpese, daEntrate, daPeriodiche] = await Promise.all([
    Spesa.distinct('userId'),
    Entrata.distinct('userId'),
    TransazionePeriodica.distinct('userId')
  ]);
  const insieme = new Set([...daSpese, ...daEntrate, ...daPeriodiche].map(String));
  return [...insieme];
}

async function contaDaSistemare() {
  const [spese, entrate, periodiche] = await Promise.all([
    Spesa.countDocuments({ componenteId: null }),
    Entrata.countDocuments({ componenteId: null }),
    TransazionePeriodica.countDocuments({ voceId: null })
  ]);
  return { spese, entrate, periodiche };
}

async function assicuraContoPrincipale(userId, creati) {
  for (const tipo of catalogoTipi) {
    const esiste = await TipoVoce.findOne({ userId, nome: tipo.nome });
    if (!esiste) {
      const nuovo = await TipoVoce.create({ ...tipo, userId, sistema: true });
      creati.tipi.push(String(nuovo._id));
    }
  }

  let voce = await Attivita.findOne({ userId, nome: 'Conto principale' });
  if (!voce) {
    const tipo = await TipoVoce.findOne({ userId, nome: 'Conti correnti' });
    voce = await Attivita.create({
      userId,
      nome: 'Conto principale',
      tipoId: tipo._id,
      note: 'Conto creato da Budget365 per i movimenti registrati prima dei conti.'
    });
    creati.voci.push(String(voce._id));
  }

  let componente = await Componente.findOne({ voceSpecie: 'attivita', voceId: voce._id, predefinita: true });
  if (!componente) {
    componente = await Componente.create({
      userId,
      voceSpecie: 'attivita',
      voceId: voce._id,
      nome: 'Conto',
      valorizzazione: 'movimenti',
      predefinita: true
    });
    creati.componenti.push(String(componente._id));
  }

  return { voce, componente };
}

async function esegui() {
  const prima = await contaDaSistemare();
  const utenti = await utentiConDati();

  console.log('Utenti con movimenti o ricorrenze:', utenti.length);
  console.log('Documenti da sistemare — spese:', prima.spese, '| entrate:', prima.entrate, '| periodiche:', prima.periodiche);

  if (!conferma) {
    console.log('\nPROVA (nessuna scrittura). Aggiungi --conferma per eseguire.');
    return;
  }

  const creati = { tipi: [], voci: [], componenti: [] };
  const toccati = { spese: [], entrate: [], periodiche: [] };

  for (const userId of utenti) {
    const { voce, componente } = await assicuraContoPrincipale(userId, creati);

    const spese = await Spesa.find({ userId, componenteId: null }).select('_id').lean();
    if (spese.length) {
      await Spesa.updateMany(
        { userId, componenteId: null },
        { $set: { voceSpecie: 'attivita', voceId: voce._id, componenteId: componente._id } }
      );
      toccati.spese.push(...spese.map((d) => String(d._id)));
    }

    const entrate = await Entrata.find({ userId, componenteId: null }).select('_id').lean();
    if (entrate.length) {
      await Entrata.updateMany(
        { userId, componenteId: null },
        { $set: { voceSpecie: 'attivita', voceId: voce._id, componenteId: componente._id } }
      );
      toccati.entrate.push(...entrate.map((d) => String(d._id)));
    }

    const periodiche = await TransazionePeriodica.find({ userId, voceId: null }).select('_id').lean();
    if (periodiche.length) {
      await TransazionePeriodica.updateMany({ userId, voceId: null }, { $set: { voceId: voce._id } });
      toccati.periodiche.push(...periodiche.map((d) => String(d._id)));
    }

    console.log(
      `  utente ${userId}: ${spese.length} spese, ${entrate.length} entrate, ${periodiche.length} periodiche → ${voce.nome}`
    );
  }

  const dopo = await contaDaSistemare();
  const fileRollback = path.join(__dirname, `rollback-fetta1-${Date.now()}.json`);
  fs.writeFileSync(fileRollback, JSON.stringify({ creati, toccati }, null, 2));

  console.log('\nDopo la migrazione — spese da sistemare:', dopo.spese, '| entrate:', dopo.entrate, '| periodiche:', dopo.periodiche);
  console.log('Creati: tipi', creati.tipi.length, '| voci', creati.voci.length, '| componenti', creati.componenti.length);
  console.log('Toccati: spese', toccati.spese.length, '| entrate', toccati.entrate.length, '| periodiche', toccati.periodiche.length);
  console.log('File di rollback:', fileRollback);
}

async function rollback(file) {
  if (!file || !fs.existsSync(file)) {
    throw new Error('Indica un file di rollback esistente');
  }
  const dati = JSON.parse(fs.readFileSync(file, 'utf8'));
  const vuoto = { $unset: { voceSpecie: '', voceId: '', componenteId: '' } };

  if (dati.toccati.spese.length) await Spesa.updateMany({ _id: { $in: dati.toccati.spese } }, vuoto);
  if (dati.toccati.entrate.length) await Entrata.updateMany({ _id: { $in: dati.toccati.entrate } }, vuoto);
  if (dati.toccati.periodiche.length) await TransazionePeriodica.updateMany({ _id: { $in: dati.toccati.periodiche } }, { $unset: { voceId: '' } });
  if (dati.creati.componenti.length) await Componente.deleteMany({ _id: { $in: dati.creati.componenti } });
  if (dati.creati.voci.length) await Attivita.deleteMany({ _id: { $in: dati.creati.voci } });
  if (dati.creati.tipi.length) await TipoVoce.deleteMany({ _id: { $in: dati.creati.tipi } });

  console.log('Rollback completato:', {
    spese: dati.toccati.spese.length,
    entrate: dati.toccati.entrate.length,
    periodiche: dati.toccati.periodiche.length,
    vociCancellate: dati.creati.voci.length,
    componentiCancellate: dati.creati.componenti.length,
    tipiCancellati: dati.creati.tipi.length
  });
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI assente in server/.env');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  console.log('Database:', uri.replace(/\/\/[^@]*@/, '//***@').replace(/\?.*$/, ''));

  if (daRollback) {
    await rollback(daRollback);
  } else {
    await esegui();
  }

  await mongoose.connection.close();
  process.exit(0);
})().catch(async (err) => {
  console.error('ERRORE:', err.message);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
