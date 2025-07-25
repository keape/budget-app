const mongoose = require('mongoose');
require('dotenv').config();

const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const BudgetSettings = require('../models/BudgetSettings');
const User = require('../models/User');

async function reassignToKeape() {
  try {
    console.log('🔄 Riassegno tutti i dati a keape...');
    
    // Connessione a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connesso a MongoDB');

    // Trova utente keape
    const keapeUser = await User.findOne({ username: 'keape' });
    if (!keapeUser) {
      console.log('❌ Utente keape non trovato nel database.');
      return;
    }
    
    console.log(`👤 Riassegno tutti i dati a: keape (${keapeUser._id})`);

    // Riassegna TUTTE le spese a keape
    const resultSpese = await Spesa.updateMany(
      {}, // Nessun filtro = tutte le spese
      { $set: { userId: keapeUser._id } }
    );
    console.log(`✅ Riassegnate ${resultSpese.modifiedCount} spese a keape`);

    // Riassegna TUTTE le entrate a keape
    const resultEntrate = await Entrata.updateMany(
      {}, // Nessun filtro = tutte le entrate
      { $set: { userId: keapeUser._id } }
    );
    console.log(`✅ Riassegnate ${resultEntrate.modifiedCount} entrate a keape`);

    // Riassegna TUTTI i budget settings a keape
    const resultBudget = await BudgetSettings.updateMany(
      {}, // Nessun filtro = tutti i budget
      { $set: { userId: keapeUser._id } }
    );
    console.log(`✅ Riassegnate ${resultBudget.modifiedCount} impostazioni budget a keape`);

    console.log('🎉 Riassegnazione completata con successo!');
    
    // Verifica risultati
    const totalSpese = await Spesa.countDocuments({ userId: keapeUser._id });
    const totalEntrate = await Entrata.countDocuments({ userId: keapeUser._id });
    const totalBudget = await BudgetSettings.countDocuments({ userId: keapeUser._id });
    
    console.log(`📈 Dati ora tutti associati a keape:`);
    console.log(`   - Spese: ${totalSpese}`);
    console.log(`   - Entrate: ${totalEntrate}`);
    console.log(`   - Budget Settings: ${totalBudget}`);

  } catch (error) {
    console.error('❌ Errore durante la riassegnazione:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnesso da MongoDB');
  }
}

// Esegui riassegnazione se chiamato direttamente
if (require.main === module) {
  reassignToKeape();
}

module.exports = reassignToKeape;