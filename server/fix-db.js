const mongoose = require('mongoose');
require('dotenv').config();

async function fixDatabase() {
  try {
    console.log('🔌 Connessione a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connesso');
    
    const db = mongoose.connection.db;
    const collection = db.collection('budgetsettings');
    
    // Lista tutti gli indici
    console.log('📋 Indici esistenti:');
    const indexes = await collection.listIndexes().toArray();
    indexes.forEach(idx => {
      console.log(`- ${idx.name}:`, idx.key);
    });
    
    // Rimuovi l'indice unique problematico
    try {
      await collection.dropIndex({ userId: 1, anno: 1, mese: 1 });
      console.log('✅ Indice unique rimosso');
    } catch (e) {
      console.log('⚠️ Indice non trovato o già rimosso:', e.message);
    }
    
    // Verifica indici rimanenti
    console.log('📋 Indici dopo rimozione:');
    const finalIndexes = await collection.listIndexes().toArray();
    finalIndexes.forEach(idx => {
      console.log(`- ${idx.name}:`, idx.key);
    });
    
    console.log('✅ Database sistemato');
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

fixDatabase();