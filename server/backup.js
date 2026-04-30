#!/usr/bin/env node
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', 'backup budget-app');

const MODELS = [
  require('./models/User'),
  require('./models/Spesa'),
  require('./models/Entrata'),
  require('./models/BudgetSettings'),
  require('./models/TransazionePeriodica'),
  require('./models/SavingsMonth'),
  require('./models/InstrumentAllocation'),
  require('./models/AllocationPlan'),
];

async function run() {
  const now = new Date();
  const label = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const outDir = path.join(BACKUP_DIR, label);

  fs.mkdirSync(outDir, { recursive: true });

  let uri = process.env.MONGODB_URI || '';
  uri = uri.replace(/^['"]|['"]$/g, '');

  console.log(`[backup] connecting…`);
  await mongoose.connect(uri);
  console.log(`[backup] connected. Writing to ${outDir}`);

  for (const Model of MODELS) {
    const name = Model.collection.name;
    const docs = await Model.find({}).lean();
    const file = path.join(outDir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(docs, null, 2));
    console.log(`[backup] ${name}: ${docs.length} docs → ${path.basename(file)}`);
  }

  await mongoose.disconnect();

  const logFile = path.join(BACKUP_DIR, 'backup.log');
  const entry = `${now.toISOString()} backup ${label} OK\n`;
  fs.appendFileSync(logFile, entry);
  console.log(`[backup] done.`);
}

run().catch(err => {
  console.error('[backup] ERROR:', err.message);
  process.exit(1);
});
