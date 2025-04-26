const Spesa = require('./models/Spesa');
const Entrata = require('./models/Entrata');
const User = require('./models/User');
const BudgetSettings = require('./models/BudgetSettings');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Configura CORS con opzioni specifiche
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://budget-app-ao5r.onrender.com',
    'https://budget-app-keape.vercel.app',
    'https://budget-app-three-gules.vercel.app',
    'https://9000-idx-budget-app-1745625859888.cluster-jbb3mjctu5cbgsi6hwq6u4bt.cloudworkstations.dev' // Added development origin
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Authorization']
};

app.use(cors(corsOptions));

// Middleware per aggiungere headers di sicurezza
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Gestione delle richieste OPTIONS
  if (req.method === 'OPTIONS') {
    const requestOrigin = req.headers.origin;
    if (corsOptions.origin.includes(requestOrigin)) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
      res.header('Access-Control-Allow-Methods', corsOptions.methods.join(','));
      res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
      res.header('Access-Control-Allow-Credentials', 'true');
      return res.sendStatus(200);
    } else {
      return res.sendStatus(403); // Forbidden if origin not allowed
    }
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

// Middleware di autenticazione
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token non fornito' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token non valido' });
    }
    req.user = user;
    next();
  });
};

// "Database" temporaneo in memoria
let elencoSpese = [
  { id: 1, descrizione: 'Spesa supermercato', importo: 42.50 },
  { id: 2, descrizione: 'dildo nero', importo: 30.00 },
  { id: 3, descrizione: 'Abbonamento Netflix', importo: 12.99 }
];

// Route GET → restituisce l'elenco delle spese con paginazione
app.get('/api/spese', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const totalSpese = await Spesa.countDocuments();
    const spese = await Spesa.find()
      .sort({ data: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      spese,
      currentPage: page,
      totalPages: Math.ceil(totalSpese / limit),
      totalItems: totalSpese
    });
  } catch (err) {
    console.error('❌ Errore nel recupero delle spese:', err);
    res.status(500).json({ error: 'Errore nel recupero delle spese' });
  }
});

// Route GET → restituisce il totale delle spese del mese corrente
app.get('/api/spese/totale-mese', authenticateToken, async (req, res) => {
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
app.post('/api/spese', authenticateToken, async (req, res) => {
  console.log('👉 Ricevuto nel body:', req.body);
  const { descrizione, importo, categoria, data } = req.body;

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
      // Escaped the single quote here
      message: 'L'importo deve essere un numero valido' 
    });
  }

  try {
    const nuovaSpesa = new Spesa({
      descrizione: descrizione || '',
      importo: -Math.abs(importoNumerico),
      categoria,
      data: data ? new Date(data) : new Date()
    });
    
    const spesaSalvata = await nuovaSpesa.save();
    
    res.status(201).json({
      success: true,
      message: `Spesa di ${Math.abs(importoNumerico).toFixed(2)}€ aggiunta con successo`,
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
app.delete('/api/spese/:id', authenticateToken, async (req, res) => {
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
app.put('/api/spese/:id', authenticateToken, async (req, res) => {
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
        data: data ? new Date(data) : undefined
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

// Route GET → restituisce l'elenco delle entrate con paginazione
app.get('/api/entrate', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const totalEntrate = await Entrata.countDocuments();
    const entrate = await Entrata.find()
      .sort({ data: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      entrate,
      currentPage: page,
      totalPages: Math.ceil(totalEntrate / limit),
      totalItems: totalEntrate
    });
  } catch (err) {
    console.error('❌ Errore nel recupero delle entrate:', err);
    res.status(500).json({ error: 'Errore nel recupero delle entrate' });
  }
});

// Route GET → restituisce il totale delle entrate del mese corrente
app.get('/api/entrate/totale-mese', authenticateToken, async (req, res) => {
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
app.post('/api/entrate', authenticateToken, async (req, res) => {
  const { descrizione, importo, categoria, data } = req.body;

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
      // Escaped the single quote here too
      message: 'L'importo deve essere un numero valido' 
    });
  }

  try {
    const nuovaEntrata = new Entrata({
      descrizione: descrizione || '',
      importo: Math.abs(importoNumerico),
      categoria,
      data: data ? new Date(data) : new Date()
    });
    
    const entrataSalvata = await nuovaEntrata.save();
    
    res.status(201).json({
      success: true,
      message: `Entrata di ${Math.abs(importoNumerico).toFixed(2)}€ aggiunta con successo`,
      data: entrataSalvata
    });
  } catch (err) {
    console.error('❌ Errore nel salvataggio dell'entrata:', err);
    res.status(500).json({ 
      error: 'Errore nel salvataggio',
      message: 'Non è stato possibile salvare l'entrata. Riprova.'
    });
  }
});

// Route PUT → modifica un'entrata esistente
app.put('/api/entrate/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { importo, descrizione, categoria, data } = req.body;

    if (!importo || !categoria) {
      return res.status(400).json({ error: 'Importo e categoria sono richiesti' });
    }

    const importoNumerico = Number(importo);
    if (isNaN(importoNumerico)) {
      // Escaped the single quote here too
      return res.status(400).json({ error: 'L'importo deve essere un numero valido' }); 
    }

    const entrata = await Entrata.findByIdAndUpdate(
      id,
      {
        descrizione: descrizione || '',
        importo: Math.abs(importoNumerico),
        categoria,
        data: data ? new Date(data) : undefined
      },
      { new: true }
    );

    if (!entrata) {
      return res.status(404).json({ error: 'Entrata non trovata' });
    }

    res.json(entrata);
  } catch (err) {
    console.error('❌ Errore nella modifica dell'entrata:', err);
    res.status(500).json({ error: 'Errore nella modifica dell'entrata' });
  }
});

// Route DELETE → elimina un'entrata
app.delete('/api/entrate/:id', authenticateToken, async (req, res) => {
  console.log('🗑️ Richiesta eliminazione entrata:', req.params.id);
  try {
    const entrata = await Entrata.findByIdAndDelete(req.params.id);
    if (!entrata) {
      console.log('❌ Entrata non trovata:', req.params.id);
      return res.status(404).json({ error: 'Entrata non trovata' });
    }
    console.log('✅ Entrata eliminata con successo:', req.params.id);
    res.json({ message: 'Entrata eliminata con successo' });
  } catch (err) {
    console.error('❌ Errore nella cancellazione dell'entrata:', err);
    res.status(500).json({ error: 'Errore nella cancellazione dell'entrata' });
  }
});

// Route per sistemare gli importi delle transazioni
app.post('/api/fix-transactions', authenticateToken, async (req, res) => {
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

// Route di test
app.get('/', (req, res) => {
  res.send('✅ Backend Budget App attivo!');
});

// Endpoint di registrazione
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username già in uso' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      password: hashedPassword
    });

    await user.save();
    res.status(201).json({ message: 'Utente registrato con successo' });
  } catch (error) {
    console.error('❌ Errore durante la registrazione:', error);
    res.status(500).json({ message: 'Errore durante la registrazione' });
  }
});

// Endpoint di login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (error) {
    console.error('❌ Errore durante il login:', error);
    res.status(500).json({ message: 'Errore durante il login' });
  }
});

// Proteggi tutte le rotte delle spese e delle entrate
// app.use('/api/spese', authenticateToken);
// app.use('/api/entrate', authenticateToken);

// Middleware per verificare il webhook token
const verifyWebhookToken = (req, res, next) => {
  const token = req.headers['x-webhook-token'];
  if (!token || token !== process.env.WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Token non valido' });
  }
  next();
};

// Route GET per ottenere le impostazioni del budget per un mese specifico
app.get('/api/budget-settings', authenticateToken, async (req, res) => {
  try {
    const { anno, mese } = req.query;
    console.log('Ricevuta richiesta GET budget settings:', { anno, mese });
    
    if (!anno || mese === undefined) {
      return res.status(400).json({ message: 'Anno e mese sono richiesti' });
    }

    const query = {
      anno: parseInt(anno), 
      mese: parseInt(mese) 
    };

    console.log('Cercando impostazioni con query:', query);
    const settings = await BudgetSettings.findOne(query);
    console.log('Impostazioni trovate:', settings);
    
    if (!settings) {
      console.log('Nessuna impostazione trovata, restituisco oggetto vuoto');
      return res.json({
        spese: {},
        entrate: {}
});
    }

    const result = {
      spese: Object.fromEntries(settings.spese),
      entrate: Object.fromEntries(settings.entrate)
    };

    console.log('Invio risultato:', result);
    res.json(result);
  } catch (error) {
    console.error('Errore nel recupero delle impostazioni del budget:', error);
    res.status(500).json({ message: 'Errore nel recupero delle impostazioni del budget' });
  }
});

app.post('/api/budget-settings', authenticateToken, async (req, res) => {
  try {
    const { anno, mese, settings } = req.body;
    console.log('Ricevuta richiesta POST budget settings:', { anno, mese, settings });

    if (!anno || mese === undefined || !settings) {
      return res.status(400).json({ message: 'Dati mancanti' });
    }

    if (!settings.spese || !settings.entrate) {
      return res.status(400).json({ message: 'La struttura dei dati non è corretta' });
    }

    const spese = new Map();
    const entrate = new Map();

    Object.entries(settings.spese).forEach(([key, value]) => {
      if (value !== null && value !== undefined && !isNaN(value)) {
        spese.set(key, Number(value));
  }
});

    Object.entries(settings.entrate).forEach(([key, value]) => {
      if (value !== null && value !== undefined && !isNaN(value)) {
        entrate.set(key, Number(value));
    }
    });

    console.log('Salvando le impostazioni:', {
      anno,
      mese,
      spese: Object.fromEntries(spese),
      entrate: Object.fromEntries(entrate)
    });

    const result = await BudgetSettings.findOneAndUpdate(
      { anno, mese },
      { 
        anno,
        mese,
        spese,
        entrate
      },
      { 
        new: true,
        upsert: true
      }
    );

    const response = {
      spese: Object.fromEntries(result.spese),
      entrate: Object.fromEntries(result.entrate)
    };

    console.log('Invio risposta:', response);
    res.json(response);
  } catch (error) {
    console.error('Errore nel salvataggio delle impostazioni del budget:', error);
    res.status(500).json({ message: 'Errore nel salvataggio delle impostazioni del budget' });
  }
});

// Esegui la sincronizzazione ogni ora
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});
