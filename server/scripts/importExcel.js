require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Spesa = require('../models/Spesa');

const MONGO_URI = 'mongodb+srv://keape86:f55GawwEdx5S1BoZ@budgetapp.enqupoz.mongodb.net/test?retryWrites=true&w=majority&appName=budgetapp';

// Funzione per pulire l'importo
function cleanImporto(importo) {
  if (typeof importo === 'string') {
    // Rimuove il simbolo € e gli spazi
    return parseFloat(importo.replace('€', '').replace(/\s/g, ''));
  }
  return importo;
}

// Funzione principale di importazione
async function importaSpese(filePath) {
  try {
    // Connessione a MongoDB
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connesso a MongoDB');

    // Leggi il file Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Trovate ${data.length} righe nel file Excel`);

    // Valida e formatta i dati
    const spese = data.map(row => {
      const importo = cleanImporto(row.Importo);
      // Converti l'importo in positivo se è una spesa (negativo nel file)
      const importoFinale = importo < 0 ? Math.abs(importo) : importo;
      
      return {
        descrizione: row.Descrizione || '',
        importo: importoFinale,
        categoria: row.Categoria,
        data: row.Data ? new Date(row.Data) : new Date()
      };
    }).filter(spesa => !isNaN(spesa.importo) && spesa.categoria);

    console.log(`✨ ${spese.length} spese valide pronte per l'importazione`);

    // Inserisci le spese in batch
    const risultato = await Spesa.insertMany(spese, { ordered: false });
    console.log(`✅ Importate con successo ${risultato.length} spese`);

  } catch (error) {
    console.error('❌ Errore durante l\'importazione:', error);
  } finally {
    // Chiudi la connessione
    await mongoose.connection.close();
    console.log('👋 Connessione a MongoDB chiusa');
  }
}

// Verifica che sia stato fornito il path del file
const filePath = process.argv[2];
if (!filePath) {
  console.error('❌ Devi specificare il path del file Excel!');
  console.log('Uso: node importExcel.js <path-del-file-excel>');
  process.exit(1);
}

// Esegui l'importazione
importaSpese(filePath); 