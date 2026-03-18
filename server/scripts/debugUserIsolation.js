const mongoose = require('mongoose');
require('dotenv').config();

const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const BudgetSettings = require('../models/BudgetSettings');
const User = require('../models/User');

async function debugUserIsolation() {
  try {
    console.log('🔍 DEBUG User Isolation - Connessione a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connesso a MongoDB');

    // Controlla utenti
    console.log('\n👥 === UTENTI ===');
    const users = await User.find({}, 'username _id');
    users.forEach(user => {
      console.log(`   ${user.username} -> ID: ${user._id}`);
    });

    // Controlla spese
    console.log('\n💸 === SPESE ===');
    const totalSpese = await Spesa.countDocuments();
    console.log(`Totale spese: ${totalSpese}`);
    
    const speseConUserId = await Spesa.countDocuments({ userId: { $exists: true } });
    const speseSenzaUserId = await Spesa.countDocuments({ userId: { $exists: false } });
    console.log(`   - Con userId: ${speseConUserId}`);
    console.log(`   - Senza userId: ${speseSenzaUserId}`);

    // Mostra le prime 5 spese per debug
    const primeCinqueSpese = await Spesa.find({}).limit(5).select('descrizione importo userId createdAt');
    console.log('\n📋 Prime 5 spese nel DB:');
    primeCinqueSpese.forEach((spesa, index) => {
      console.log(`   ${index + 1}. ${spesa.descrizione || 'N/A'} - €${spesa.importo} - userId: ${spesa.userId || 'MANCANTE'} - ${spesa.createdAt}`);
    });

    // Controlla entrate
    console.log('\n💰 === ENTRATE ===');
    const totalEntrate = await Entrata.countDocuments();
    console.log(`Totale entrate: ${totalEntrate}`);
    
    const entrateConUserId = await Entrata.countDocuments({ userId: { $exists: true } });
    const entrateSenzaUserId = await Entrata.countDocuments({ userId: { $exists: false } });
    console.log(`   - Con userId: ${entrateConUserId}`);
    console.log(`   - Senza userId: ${entrateSenzaUserId}`);

    // Controlla budget settings
    console.log('\n⚙️ === BUDGET SETTINGS ===');
    const totalBudget = await BudgetSettings.countDocuments();
    console.log(`Totale budget settings: ${totalBudget}`);
    
    const budgetConUserId = await BudgetSettings.countDocuments({ userId: { $exists: true } });
    const budgetSenzaUserId = await BudgetSettings.countDocuments({ userId: { $exists: false } });
    console.log(`   - Con userId: ${budgetConUserId}`);
    console.log(`   - Senza userId: ${budgetSenzaUserId}`);

    // Test isolamento per ogni utente
    console.log('\n🔒 === TEST ISOLAMENTO ===');
    for (const user of users) {
      const userSpese = await Spesa.countDocuments({ userId: user._id });
      const userEntrate = await Entrata.countDocuments({ userId: user._id });
      const userBudget = await BudgetSettings.countDocuments({ userId: user._id });
      console.log(`   ${user.username}: ${userSpese} spese, ${userEntrate} entrate, ${userBudget} budget settings`);
    }

    console.log('\n🎯 DEBUG completato!');

  } catch (error) {
    console.error('❌ Errore durante il debug:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnesso da MongoDB');
  }
}

// Esegui debug se chiamato direttamente
if (require.main === module) {
  debugUserIsolation();
}

module.exports = debugUserIsolation;