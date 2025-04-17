const Spesa = require('./models/Spesa');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Middleware per aggiungere headers CORS manualmente
app.use((req, res, next) => {
  // Accetta richieste sia dall'app web che da iOS Shortcuts
  const allowedOrigins = ['https://budget-app-three-gules.vercel.app', 'shortcuts://'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Gestione richieste OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connessione a MongoDB riuscita'))
.catch((err) => console.error('❌ Errore di connessione a MongoDB:', err));

app.use(express.json());

// Middleware per il logging delle richieste
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path} - Origin: ${req.get('origin')}`);
  next();
});

// "Database" temporaneo in memoria
let elencoSpese = [
  { id: 1, descrizione: 'Spesa supermercato', importo: 42.50 },
  { id: 2, descrizione: 'dildo nero', importo: 30.00 },
  { id: 3, descrizione: 'Abbonamento Netflix', importo: 12.99 }
];

// Route GET → restituisce l'elenco delle spese
app.get('/api/spese', async (req, res) => {
  try {
    const spese = await Spesa.find().sort({ data: -1 });
    res.json(spese);
  } catch (err) {
    console.error('❌ Errore nel recupero delle spese:', err);
    res.status(500).json({ error: 'Errore nel recupero delle spese' });
  }
});

// Route POST → aggiunge una nuova spesa
app.post('/api/spese', async (req, res) => {
  console.log('👉 Ricevuto nel body:', req.body);
  const { descrizione, importo, categoria } = req.body;

  // Validazione più robusta per iOS Shortcuts
  if (!importo) {
    return res.status(400).json({ 
      error: 'Importo mancante',
      message: 'Inserisci un importo valido'
    });
  }

  if (!categoria) {
    return res.status(400).json({ 
      error: 'Categoria mancante',
      message: 'Seleziona una categoria'
    });
  }

  // Validazione del formato dell'importo
  const importoNumerico = Number(importo);
  if (isNaN(importoNumerico)) {
    return res.status(400).json({ 
      error: 'Importo non valido',
      message: 'L\'importo deve essere un numero valido'
    });
  }

  try {
    const nuovaSpesa = new Spesa({
      descrizione: descrizione || '',
      importo: importoNumerico,
      categoria,
      data: new Date()
    });
    
    const spesaSalvata = await nuovaSpesa.save();
    
    // Risposta formattata per iOS Shortcuts
    res.status(201).json({
      success: true,
      message: `Spesa di ${importoNumerico.toFixed(2)}€ aggiunta con successo`,
      data: spesaSalvata
    });
  } catch (err) {
    console.error('❌ Errore nel salvataggio della spesa:', err);
    res.status(500).json({ 
      error: 'Errore nel salvataggio',
      message: 'Non è stato possibile salvare la spesa. Riprova.'
    });
  }
});

// Route DELETE → elimina una spesa
app.delete('/api/spese/:id', async (req, res) => {
  console.log('🗑️ Richiesta eliminazione spesa:', req.params.id);
  try {
    const spesa = await Spesa.findByIdAndDelete(req.params.id);
    if (!spesa) {
      console.log('❌ Spesa non trovata:', req.params.id);
      return res.status(404).json({ error: 'Spesa non trovata' });
    }
    console.log('✅ Spesa eliminata con successo:', req.params.id);
    res.json({ message: 'Spesa eliminata con successo' });
  } catch (err) {
    console.error('❌ Errore nella cancellazione della spesa:', err);
    res.status(500).json({ error: 'Errore nella cancellazione della spesa' });
  }
});

// Route PUT → modifica una spesa esistente
app.put('/api/spese/:id', async (req, res) => {
  const { id } = req.params;
  const { descrizione, importo, categoria, data } = req.body;

  if (!importo || !categoria) {
    return res.status(400).json({ error: 'Dati mancanti' });
  }

  try {
    const spesa = await Spesa.findByIdAndUpdate(
      id,
      {
        descrizione,
        importo: Number(importo),
        categoria,
        data: data || Date.now()
      },
      { new: true }
    );

    if (!spesa) {
      return res.status(404).json({ error: 'Spesa non trovata' });
    }

    res.json(spesa);
  } catch (err) {
    console.error('❌ Errore nella modifica della spesa:', err);
    res.status(500).json({ error: 'Errore nella modifica della spesa' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});

app.get('/', (req, res) => {
  res.send('✅ Backend Budget App attivo!');
});
