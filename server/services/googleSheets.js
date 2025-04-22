require('dotenv').config();
const { google } = require('googleapis');
const sheets = google.sheets('v4');

// Funzione per ottenere l'elenco dei fogli
async function getSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const client = await auth.getClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    console.log('Tentativo di accesso al foglio con ID:', spreadsheetId);
    
    const response = await sheets.spreadsheets.get({
      auth: client,
      spreadsheetId,
    });

    console.log('Risposta completa:', JSON.stringify(response.data, null, 2));
    console.log('Fogli disponibili:', response.data.sheets.map(sheet => sheet.properties.title));
    return response.data.sheets;
  } catch (error) {
    console.error('Errore nel recupero dei fogli:', error);
    if (error.response) {
      console.error('Dettagli errore:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// Funzione per leggere le ultime righe dal foglio
async function getLatestTransactions() {
  try {
    // Crea il client di autenticazione
    const auth = new google.auth.GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const authClient = await auth.getClient();

    // Crea il client delle Sheets API
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // ID del foglio e range
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = 'Foglio1!A2:D';

    console.log('Tentativo di lettura dei valori da:', range);

    // Leggi i valori
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    console.log('Risultato della lettura:', result);

    const rows = result.data.values;
    if (!rows || rows.length === 0) {
      console.log('Nessun dato trovato.');
      return [];
    }

    // Processa i dati
    return rows.map(row => ({
      data: row[0] || '',
      importo: row[1] ? parseFloat(row[1].toString()) : 0,
      categoria: row[2] || '',
      descrizione: row[3] || '',
      tipo: 'uscita',
      sheetId: `${row[0]}-${row[1]}-${row[2]}`
    }));
  } catch (error) {
    console.error('Errore:', error);
    throw error;
  }
}

// Funzione per verificare se ci sono nuove transazioni
async function checkNewTransactions() {
  try {
    const transactions = await getLatestTransactions();
    // Qui puoi aggiungere la logica per verificare quali transazioni sono nuove
    return transactions;
  } catch (error) {
    console.error('Errore nel controllo delle nuove transazioni:', error);
    throw error;
  }
}

// Funzione per verificare i permessi
async function checkPermissions() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const client = await auth.getClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    console.log('Tentativo di accesso al foglio con ID:', spreadsheetId);
    
    // Verifica i permessi del foglio
    const drive = google.drive({ version: 'v3', auth: client });
    const permissions = await drive.permissions.list({
      fileId: spreadsheetId,
      fields: 'permissions(id,emailAddress,role,type)'
    });

    console.log('Permessi del foglio:', JSON.stringify(permissions.data, null, 2));
    return permissions.data;
  } catch (error) {
    console.error('Errore nella verifica dei permessi:', error);
    if (error.response) {
      console.error('Dettagli errore:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

module.exports = {
  getLatestTransactions,
  checkNewTransactions,
  getSheets,
  checkPermissions
}; 