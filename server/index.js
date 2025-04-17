const Spesa = require('./models/Spesa');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Middleware per aggiungere headers CORS manualmente
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://budget-app-three-gules.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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

  if (!importo || !categoria) {
    return res.status(400).json({ error: 'Dati mancanti' });
  }  

  try {
    const nuovaSpesa = new Spesa({
      descrizione,
      importo: Number(importo),
      categoria
    });
    const spesaSalvata = await nuovaSpesa.save();
    res.status(201).json(spesaSalvata);
  } catch (err) {
    console.error('❌ Errore nel salvataggio della spesa:', err);
    res.status(500).json({ error: 'Errore nel salvataggio della spesa' });
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

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});

app.get('/', (req, res) => {
  res.send('✅ Backend Budget App attivo!');
});
