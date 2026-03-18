require('dotenv').config();
const mongoose = require('mongoose');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');

const MONGO_URI = process.env.MONGO_URI;

async function fixTransactions() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connesso a MongoDB');

    // Fix spese
    const spese = await Spesa.find();
    console.log(`Trovate ${spese.length} spese da sistemare`);
    
    for (const spesa of spese) {
      spesa.importo = -Math.abs(spesa.importo);
      await spesa.save();
    }
    console.log('✅ Spese sistemate');

    // Fix entrate
    const entrate = await Entrata.find();
    console.log(`Trovate ${entrate.length} entrate da sistemare`);
    
    for (const entrata of entrate) {
      entrata.importo = Math.abs(entrata.importo);
      await entrata.save();
    }
    console.log('✅ Entrate sistemate');

    console.log('✅ Tutte le transazioni sono state sistemate');
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

fixTransactions(); 