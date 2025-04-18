const Spesa = require('./models/Spesa');
const Entrata = require('./models/Entrata');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Middleware per aggiungere headers CORS manualmente
app.use(cors({
  origin: ['https://budget-app-three-gules.vercel.app', 'http://localhost:3000', 'shortcuts://'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

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

// Route GET → restituisce il totale delle spese del mese corrente
app.get('/api/spese/totale-mese', async (req, res) => {
  try {
    const oggi = new Date();
    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);

    const spese = await Spesa.find({
      data: {
        $gte: inizioMese,
        $lte: fineMese
      }
    });

    const totale = spese.reduce((acc, spesa) => acc + spesa.importo, 0);
    
    res.json({
      totale: totale.toFixed(2),
      mese: oggi.toLocaleString('it-IT', { month: 'long' }),
      anno: oggi.getFullYear()
    });
  } catch (err) {
    console.error('❌ Errore nel calcolo del totale mensile:', err);
    res.status(500).json({ error: 'Errore nel calcolo del totale mensile' });
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

// Route GET → restituisce l'elenco delle entrate
app.get('/api/entrate', async (req, res) => {
  try {
    const entrate = await Entrata.find().sort({ data: -1 });
    res.json(entrate);
  } catch (err) {
    console.error('❌ Errore nel recupero delle entrate:', err);
    res.status(500).json({ error: 'Errore nel recupero delle entrate' });
  }
});

// Route GET → restituisce il totale delle entrate del mese corrente
app.get('/api/entrate/totale-mese', async (req, res) => {
  try {
    const oggi = new Date();
    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);

    const entrate = await Entrata.find({
      data: {
        $gte: inizioMese,
        $lte: fineMese
      }
    });

    const totale = entrate.reduce((acc, entrata) => acc + entrata.importo, 0);
    
    res.json({
      totale: totale.toFixed(2),
      mese: oggi.toLocaleString('it-IT', { month: 'long' }),
      anno: oggi.getFullYear()
    });
  } catch (err) {
    console.error('❌ Errore nel calcolo del totale mensile delle entrate:', err);
    res.status(500).json({ error: 'Errore nel calcolo del totale mensile delle entrate' });
  }
});

// Route POST → aggiunge una nuova entrata
app.post('/api/entrate', async (req, res) => {
  const { descrizione, importo, categoria } = req.body;

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

  const importoNumerico = Number(importo);
  if (isNaN(importoNumerico)) {
    return res.status(400).json({ 
      error: 'Importo non valido',
      message: 'L\'importo deve essere un numero valido'
    });
  }

  try {
    const nuovaEntrata = new Entrata({
      descrizione: descrizione || '',
      importo: importoNumerico,
      categoria,
      data: new Date()
    });
    
    const entrataSalvata = await nuovaEntrata.save();
    
    res.status(201).json({
      success: true,
      message: `Entrata di ${importoNumerico.toFixed(2)}€ aggiunta con successo`,
      data: entrataSalvata
    });
  } catch (err) {
    console.error('❌ Errore nel salvataggio dell\'entrata:', err);
    res.status(500).json({ 
      error: 'Errore nel salvataggio',
      message: 'Non è stato possibile salvare l\'entrata. Riprova.'
    });
  }
});

// Route per sistemare gli importi delle transazioni
app.post('/api/fix-transactions', async (req, res) => {
  try {
    // Fix spese
    const spese = await Spesa.find();
    console.log(`Trovate ${spese.length} spese da sistemare`);
    
    for (const spesa of spese) {
      spesa.importo = -Math.abs(spesa.importo);
      await spesa.save();
    }

    // Fix entrate
    const entrate = await Entrata.find();
    console.log(`Trovate ${entrate.length} entrate da sistemare`);
    
    for (const entrata of entrate) {
      entrata.importo = Math.abs(entrata.importo);
      await entrata.save();
    }

    res.json({ 
      success: true, 
      message: `Sistemate ${spese.length} spese e ${entrate.length} entrate` 
    });
  } catch (err) {
    console.error('❌ Errore nella correzione delle transazioni:', err);
    res.status(500).json({ error: 'Errore nella correzione delle transazioni' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});

app.get('/', (req, res) => {
  res.send('✅ Backend Budget App attivo!');
});
