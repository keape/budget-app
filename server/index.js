const Spesa = require('./models/Spesa');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connessione a MongoDB riuscita'))
.catch((err) => console.error('❌ Errore di connessione a MongoDB:', err));

const corsOptions = {
  origin: ['https://budget-app-three-psi.vercel.app', 'http://localhost:3000', 'https://budget-app-keape86.vercel.app'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

app.use(express.json());

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
      importo,
      categoria
    });
    const spesaSalvata = await nuovaSpesa.save();
    res.status(201).json(spesaSalvata);
  } catch (err) {
    res.status(500).json({ error: 'Errore nel salvataggio della spesa' });
  }
});



const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});


app.get('/', (req, res) => {
  res.send('✅ Backend Budget App attivo!');
});
