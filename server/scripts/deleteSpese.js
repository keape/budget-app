require('dotenv').config();
const mongoose = require('mongoose');
const Spesa = require('../models/Spesa');

const MONGO_URI = process.env.MONGO_URI;

async function deleteSpese() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connesso a MongoDB');

    const result = await Spesa.deleteMany({});
    console.log(`🗑️ Eliminate ${result.deletedCount} spese`);

  } catch (error) {
    console.error('❌ Errore durante l\'eliminazione:', error);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Connessione a MongoDB chiusa');
  }
}

deleteSpese(); 