require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Spesa = require('../models/Spesa');

const MONGO_URI = process.env.MONGO_URI;

// Funzione per pulire l'importo
function cleanImporto(importo) {
  if (typeof importo === 'string') {
    // Rimuove il simbolo € e gli spazi
    return parseFloat(importo.replace('€', '').replace(/\s/g, ''));
  }
  return importo;
}

// Funzione per convertire la data Excel in formato JavaScript
function parseExcelDate(excelDate) {
  // Se non c'è data, ritorna null per gestire l'errore
  if (!excelDate) return null;

  try {
    // Se è una data Excel (numero seriale)
    if (typeof excelDate === 'number') {
      const date = XLSX.SSF.parse_date_code(excelDate);
      return new Date(date.y, date.m - 1, date.d);
    }

    // Se è una stringa in formato YYYY-MM-DD
    if (typeof excelDate === 'string' && excelDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Date(excelDate);
    }

    // Se è una stringa in formato DD/MM/YYYY
    if (typeof excelDate === 'string' && excelDate.includes('/')) {
      const [giorno, mese, anno] = excelDate.split('/').map(Number);
      if (!isNaN(giorno) && !isNaN(mese) && !isNaN(anno)) {
        return new Date(anno, mese - 1, giorno);
      }
    }

    // Se è un oggetto Date
    if (excelDate instanceof Date && !isNaN(excelDate)) {
      return excelDate;
    }

    console.warn('⚠️ Formato data non riconosciuto:', excelDate);
    return null;
  } catch (error) {
    console.error('❌ Errore nel parsing della data:', error);
    return null;
  }
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

    // Leggi il file Excel con opzioni specifiche
    const workbook = XLSX.readFile(filePath, {
      cellDates: true,  // Converte le date in oggetti Date
      dateNF: 'yyyy-mm-dd'  // Formato data preferito
    });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Converti il foglio in JSON mantenendo i tipi di dati
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,  // Non convertire i valori
      dateNF: 'yyyy-mm-dd'  // Formato data per l'output
    });

    console.log(`📊 Trovate ${data.length} righe nel file Excel`);

    // Valida e formatta i dati
    const spese = data.map(row => {
      const importo = cleanImporto(row.Importo);
      const data = parseExcelDate(row.Data);
      
      // Se non riusciamo a parsare la data, logghiamo un warning
      if (!data) {
        console.warn('⚠️ Data non valida per la riga:', row);
        return null;
      }

      // La Spesa si conserva sempre negativa, come fanno le rotte (routes/spese.js,
      // `-Math.abs(importo)`): il Patrimonio somma gli importi così come sono in archivio,
      // quindi una Spesa positiva gonfia il saldo del conto invece di abbassarlo.
      // Attenzione: questo script crea solo Spese. Le righe di entrata vanno importate
      // a parte, altrimenti finiscono qui come uscite.
      const importoFinale = -Math.abs(importo);
      
      return {
        descrizione: row.Descrizione || '',
        importo: importoFinale,
        categoria: row.Categoria,
        data: data
      };
    }).filter(spesa => spesa && !isNaN(spesa.importo) && spesa.categoria);

    console.log(`✨ ${spese.length} spese valide pronte per l'importazione`);
    
    // Log delle prime 5 spese per verifica
    console.log('🔍 Prime 5 spese di esempio:');
    spese.slice(0, 5).forEach(spesa => {
      console.log(`   ${spesa.data.toISOString().split('T')[0]} - ${spesa.categoria}: ${spesa.importo}€ (${spesa.descrizione || 'Nessuna descrizione'})`);
    });

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