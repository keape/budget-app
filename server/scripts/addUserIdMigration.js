const mongoose = require('mongoose');
require('dotenv').config();

const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const BudgetSettings = require('../models/BudgetSettings');
const User = require('../models/User');

async function migrateUserIsolation() {
  try {
    console.log('🔄 Avvio migration per user isolation...');
    
    // Connessione a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connesso a MongoDB');

    // Trova il primo utente disponibile per assegnare dati orfani
    const firstUser = await User.findOne();
    if (!firstUser) {
      console.log('❌ Nessun utente trovato nel database. Crea prima un utente.');
      return;
    }
    
    console.log(`👤 Assegno dati orfani all'utente: ${firstUser.username} (${firstUser._id})`);

    // Migra Spese senza userId
    const speseOrfane = await Spesa.find({ userId: { $exists: false } });
    console.log(`📊 Trovate ${speseOrfane.length} spese senza userId`);
    
    if (speseOrfane.length > 0) {
      await Spesa.updateMany(
        { userId: { $exists: false } },
        { $set: { userId: firstUser._id } }
      );
      console.log(`✅ Migrate ${speseOrfane.length} spese`);
    }

    // Migra Entrate senza userId
    const entrateOrfane = await Entrata.find({ userId: { $exists: false } });
    console.log(`📊 Trovate ${entrateOrfane.length} entrate senza userId`);
    
    if (entrateOrfane.length > 0) {
      await Entrata.updateMany(
        { userId: { $exists: false } },
        { $set: { userId: firstUser._id } }
      );
      console.log(`✅ Migrate ${entrateOrfane.length} entrate`);
    }

    // Migra BudgetSettings senza userId
    const budgetOrfani = await BudgetSettings.find({ userId: { $exists: false } });
    console.log(`📊 Trovate ${budgetOrfani.length} impostazioni budget senza userId`);
    
    if (budgetOrfani.length > 0) {
      await BudgetSettings.updateMany(
        { userId: { $exists: false } },
        { $set: { userId: firstUser._id } }
      );
      console.log(`✅ Migrate ${budgetOrfani.length} impostazioni budget`);
    }

    console.log('🎉 Migration completata con successo!');
    
    // Verifica risultati
    const totalSpese = await Spesa.countDocuments({ userId: firstUser._id });
    const totalEntrate = await Entrata.countDocuments({ userId: firstUser._id });
    const totalBudget = await BudgetSettings.countDocuments({ userId: firstUser._id });
    
    console.log(`📈 Dati ora associati all'utente ${firstUser.username}:`);
    console.log(`   - Spese: ${totalSpese}`);
    console.log(`   - Entrate: ${totalEntrate}`);
    console.log(`   - Budget Settings: ${totalBudget}`);

  } catch (error) {
    console.error('❌ Errore durante la migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnesso da MongoDB');
  }
}

// Esegui migration se chiamato direttamente
if (require.main === module) {
  migrateUserIsolation();
}

module.exports = migrateUserIsolation;