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

// CORS Configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://budget-app-ao5r.onrender.com',
    'https://budget-app-keape.vercel.app',
    'https://budget-app-three-gules.vercel.app',
    'https://9000-idx-budget-app-1745625859888.cluster-jbb3mjctu5cbgsi6hwq6u4bt.cloudworkstations.dev'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Authorization']
};
app.use(cors(corsOptions));

// Security Headers Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  if (req.method === 'OPTIONS') {
    const requestOrigin = req.headers.origin;
    if (corsOptions.origin.includes(requestOrigin)) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
      res.header('Access-Control-Allow-Methods', corsOptions.methods.join(','));
      res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
      res.header('Access-Control-Allow-Credentials', 'true');
      return res.sendStatus(200);
    } else {
      return res.sendStatus(403);
    }
  }
  next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connessione a MongoDB riuscita'))
.catch((err) => console.error('❌ Errore di connessione a MongoDB:', err));

app.use(express.json());

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path} - Origin: ${req.get('origin')}`);
  next();
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: "Token non fornito" });
  }
  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Token non valido" });
    }
    req.user = user; // Attach user info to the request
    next();
  });
};

// --- Budget Settings Routes --- 

// GET Budget Settings (Handles Monthly and Yearly)
app.get('/api/budget-settings', authenticateToken, async (req, res) => {
  // Log diagnostico
  console.log(`[DIAGNOSTIC LOG - GET v1.2] Received request for anno=${req.query.anno}, mese=${req.query.mese}, user=${req.user.userId}`);
  try {
    const { anno } = req.query;
    let { mese } = req.query;

    if (!anno) {
      return res.status(400).json({ message: 'Anno è richiesto' });
    }

    const parsedAnno = parseInt(anno);
    let parsedMese = (mese !== undefined && mese !== null && !isNaN(parseInt(mese)) && parseInt(mese) >= 0 && parseInt(mese) <= 11) 
                     ? parseInt(mese) 
                     : null; 

    let query;
    let settings = null;

    // Costruisci la query base con user e anno
    const baseQuery = { user: req.user.userId, anno: parsedAnno };

    if (parsedMese !== null) {
      // Cerca prima il mese specifico
      query = { ...baseQuery, mese: parsedMese };
      console.log(`[GET Budget v1.2] Searching specific month for user ${req.user.userId}:`, query);
      settings = await BudgetSettings.findOne(query);
      
      // Se non trovato, cerca il fallback annuale
      if (!settings) {
        query = { ...baseQuery, mese: null };
        console.log(`[GET Budget v1.2] Specific not found, searching annual fallback for user ${req.user.userId}:`, query);
        settings = await BudgetSettings.findOne(query);
      }
    } else {
      // Cerca solo l'annuale
      query = { ...baseQuery, mese: null };
      console.log(`[GET Budget v1.2] Searching only annual for user ${req.user.userId}:`, query);
      settings = await BudgetSettings.findOne(query);
    }

    let result = { spese: {}, entrate: {} };
    if (settings) {
      console.log(`[GET Budget v1.2] Settings found:`, settings._id, `for query:`, query);
      result = {
        spese: settings.spese ? Object.fromEntries(settings.spese) : {},
        entrate: settings.entrate ? Object.fromEntries(settings.entrate) : {}
      };
    } else {
       console.log(`[GET Budget v1.2] No settings found for query:`, query);
    }
    res.json(result);

  } catch (error) {
    console.error('[GET Budget v1.2] Errore nel recupero delle impostazioni del budget:', error);
    res.status(500).json({ message: 'Errore interno nel recupero delle impostazioni del budget' });
  }
});

// POST Budget Settings (Handles Monthly and Yearly) - VERSIONE CORRETTA
app.post('/api/budget-settings', authenticateToken, async (req, res) => {
  // Log diagnostico aggiornato
  console.log(`[DIAGNOSTIC LOG - POST v1.2] Received request body:`, JSON.stringify(req.body)); 
  console.log(`[DIAGNOSTIC LOG - POST v1.2] User ID from auth: ${req.user.userId}`);
  
  try {
    // *** LOGICA CORRETTA ***
    const { anno, settings } = req.body;
    // mese può essere null per annuale, o un numero 0-11
    const mese = req.body.mese === null ? null : parseInt(req.body.mese);
    
    console.log(`[POST Budget v1.2] Interpreted - Anno: ${anno}, Mese: ${mese} (Type: ${typeof mese}), User: ${req.user.userId}`);

    // Validazione input
    if (anno === undefined || mese === undefined || !settings) { // Mese può essere null, quindi checkiamo undefined
      console.error('[POST Budget v1.2] Validation Error: Dati mancanti');
      return res.status(400).json({ message: 'Dati mancanti (anno, mese [può essere null], settings)' });
    }
    
    const parsedAnno = parseInt(anno);
    if(isNaN(parsedAnno)) {
      console.error('[POST Budget v1.2] Validation Error: Anno non valido');
      return res.status(400).json({ message: 'Anno non valido.' });
    }

    // Validazione mese solo se non è null
    if (mese !== null && (isNaN(mese) || mese < 0 || mese > 11)) {
         console.error('[POST Budget v1.2] Validation Error: Mese non valido (non nullo)');
         return res.status(400).json({ message: 'Mese non valido. Deve essere tra 0 e 11, o null per annuale.' });
    }

    if (!settings.spese || typeof settings.spese !== 'object' || !settings.entrate || typeof settings.entrate !== 'object') {
        console.error('[POST Budget v1.2] Validation Error: Struttura settings non corretta');
        return res.status(400).json({ message: 'La struttura dei dati settings non è corretta (spese/entrate devono essere oggetti)' });
    }

    // Preparazione dati per Mongoose (Map)
    const spese = new Map();
    const entrate = new Map();
    Object.entries(settings.spese).forEach(([key, value]) => {
      const numValue = parseFloat(value);
      if (typeof key === 'string' && key.trim() !== '' && value !== null && value !== undefined && !isNaN(numValue)) {
        spese.set(key.trim(), numValue); 
      }
    });
    Object.entries(settings.entrate).forEach(([key, value]) => {
       const numValue = parseFloat(value);
       if (typeof key === 'string' && key.trim() !== '' && value !== null && value !== undefined && !isNaN(numValue)) {
        entrate.set(key.trim(), numValue);
      }
    });

    // Query e dati per aggiornamento/inserimento
    const query = { user: req.user.userId, anno: parsedAnno, mese: mese }; 
    const update = { user: req.user.userId, anno: parsedAnno, mese: mese, spese, entrate };
    const options = { new: true, upsert: true, setDefaultsOnInsert: true };

    console.log(`[POST Budget v1.2] Saving settings for user ${req.user.userId} with query:`, query);
    const result = await BudgetSettings.findOneAndUpdate(query, update, options);

    // Preparazione risposta
    const response = {
      spese: result.spese ? Object.fromEntries(result.spese) : {},
      entrate: result.entrate ? Object.fromEntries(result.entrate) : {}
    };
    
    console.log(`[POST Budget v1.2] Settings saved/updated successfully for user ${req.user.userId}, query:`, query);
    res.json(response);

  } catch (error) {
    console.error('[POST Budget v1.2] Errore nel salvataggio delle impostazioni del budget:', error);
    console.error('[POST Budget v1.2] Error details:', error.message, error.stack);
    if (error.name === 'ValidationError') {
        console.error('[POST Budget v1.2] Mongoose Validation Error:', error.errors);
        return res.status(400).json({ message: 'Errore di validazione: ' + error.message, errors: error.errors });
    }
    // Errore chiave duplicata (potrebbe accadere con upsert se gli indici non sono perfetti)
    if (error.code === 11000) { 
         console.error('[POST Budget v1.2] Duplicate key error:', error.keyValue);
         return res.status(409).json({ message: "Errore: Conflitto - Impostazione duplicata rilevata.", details: error.keyValue });
    }
    res.status(500).json({ message: 'Errore interno nel salvataggio delle impostazioni del budget' });
  }
});


// --- Other Routes (Spese, Entrate, Auth) ---

// GET /api/spese (Paginated)
app.get('/api/spese', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const totalSpese = await Spesa.countDocuments({ user: req.user.userId }); // Filter by user
    const spese = await Spesa.find({ user: req.user.userId }).sort({ data: -1 }).skip(skip).limit(limit); // Filter by user
    res.json({ spese, currentPage: page, totalPages: Math.ceil(totalSpese / limit), totalItems: totalSpese });
  } catch (err) {
    console.error('❌ Errore nel recupero delle spese:', err);
    res.status(500).json({ error: "Errore nel recupero delle spese" });
  }
});

// GET /api/spese/totale-mese
app.get('/api/spese/totale-mese', authenticateToken, async (req, res) => {
  try {
    const oggi = new Date();
    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);
    const spese = await Spesa.find({ 
        user: req.user.userId, // Filter by user
        data: { $gte: inizioMese, $lte: fineMese } 
    });
    const totale = spese.reduce((acc, spesa) => acc + spesa.importo, 0);
    res.json({ totale: totale.toFixed(2), mese: oggi.toLocaleString('it-IT', { month: 'long' }), anno: oggi.getFullYear() });
  } catch (err) {
    console.error('❌ Errore nel calcolo del totale mensile:', err);
    res.status(500).json({ error: "Errore nel calcolo del totale mensile" });
  }
});

// POST /api/spese
app.post('/api/spese', authenticateToken, async (req, res) => {
  console.log('👉 Ricevuto nel body:', req.body);
  const { descrizione, importo, categoria, data } = req.body;
  if (!importo) return res.status(400).json({ error: "Importo mancante", message: "Inserisci un importo valido" });
  if (!categoria) return res.status(400).json({ error: "Categoria mancante", message: "Seleziona una categoria" });
  const importoNumerico = Number(importo);
  if (isNaN(importoNumerico)) return res.status(400).json({ error: "Importo non valido", message: "L'importo deve essere un numero valido" });
  try {
    const nuovaSpesa = new Spesa({ 
        descrizione: descrizione || '', 
        importo: -Math.abs(importoNumerico), 
        categoria, 
        data: data ? new Date(data) : new Date(),
        user: req.user.userId // Associate with user
    });
    const spesaSalvata = await nuovaSpesa.save();
    res.status(201).json({ success: true, message: `Spesa di ${Math.abs(importoNumerico).toFixed(2)}€ aggiunta con successo`, data: spesaSalvata });
  } catch (err) {
    console.error('❌ Errore nel salvataggio della spesa:', err);
    res.status(500).json({ error: "Errore nel salvataggio", message: "Non è stato possibile salvare la spesa. Riprova." });
  }
});

// DELETE /api/spese/:id
app.delete('/api/spese/:id', authenticateToken, async (req, res) => {
  console.log('🗑️ Richiesta eliminazione spesa:', req.params.id);
  try {
    // Ensure the user can only delete their own expenses
    const spesa = await Spesa.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
    if (!spesa) return res.status(404).json({ error: "Spesa non trovata o non autorizzato" });
    console.log('✅ Spesa eliminata con successo:', req.params.id);
    res.json({ message: "Spesa eliminata con successo" });
  } catch (err) {
    console.error('❌ Errore nella cancellazione della spesa:', err);
    res.status(500).json({ error: "Errore nella cancellazione della spesa" });
  }
});

// PUT /api/spese/:id
app.put('/api/spese/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { descrizione, importo, categoria, data } = req.body;
  if (!importo || !categoria) return res.status(400).json({ error: "Dati mancanti" });
  const importoNumerico = Number(importo);
  if (isNaN(importoNumerico)) return res.status(400).json({ error: "Importo non valido" });
  try {
    // Ensure the user can only update their own expenses
    const spesa = await Spesa.findOneAndUpdate(
        { _id: id, user: req.user.userId }, 
        { descrizione, importo: -Math.abs(importoNumerico), categoria, data: data ? new Date(data) : undefined }, 
        { new: true }
    );
    if (!spesa) return res.status(404).json({ error: "Spesa non trovata o non autorizzato" });
    res.json(spesa);
  } catch (err) {
    console.error('❌ Errore nella modifica della spesa:', err);
    res.status(500).json({ error: "Errore nella modifica della spesa" });
  }
});

// GET /api/entrate (Paginated)
app.get('/api/entrate', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const totalEntrate = await Entrata.countDocuments({ user: req.user.userId }); // Filter by user
    const entrate = await Entrata.find({ user: req.user.userId }).sort({ data: -1 }).skip(skip).limit(limit); // Filter by user
    res.json({ entrate, currentPage: page, totalPages: Math.ceil(totalEntrate / limit), totalItems: totalEntrate });
  } catch (err) {
    console.error('❌ Errore nel recupero delle entrate:', err);
    res.status(500).json({ error: "Errore nel recupero delle entrate" });
  }
});

// GET /api/entrate/totale-mese
app.get('/api/entrate/totale-mese', authenticateToken, async (req, res) => {
  try {
    const oggi = new Date();
    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);
    const entrate = await Entrata.find({ 
        user: req.user.userId, // Filter by user
        data: { $gte: inizioMese, $lte: fineMese } 
    });
    const totale = entrate.reduce((acc, entrata) => acc + entrata.importo, 0);
    res.json({ totale: totale.toFixed(2), mese: oggi.toLocaleString('it-IT', { month: 'long' }), anno: oggi.getFullYear() });
  } catch (err) {
    console.error('❌ Errore nel calcolo del totale mensile delle entrate:', err);
    res.status(500).json({ error: "Errore nel calcolo del totale mensile delle entrate" });
  }
});

// POST /api/entrate
app.post('/api/entrate', authenticateToken, async (req, res) => {
  const { descrizione, importo, categoria, data } = req.body;
  if (!importo) return res.status(400).json({ error: "Importo mancante", message: "Inserisci un importo valido" });
  if (!categoria) return res.status(400).json({ error: "Categoria mancante", message: "Seleziona una categoria" });
  const importoNumerico = Number(importo);
  if (isNaN(importoNumerico)) return res.status(400).json({ error: "Importo non valido", message: "L'importo deve essere un numero valido" });
  try {
    const nuovaEntrata = new Entrata({ 
        descrizione: descrizione || '', 
        importo: Math.abs(importoNumerico), 
        categoria, 
        data: data ? new Date(data) : new Date(),
        user: req.user.userId // Associate with user
    });
    const entrataSalvata = await nuovaEntrata.save();
    res.status(201).json({ success: true, message: `Entrata di ${Math.abs(importoNumerico).toFixed(2)}€ aggiunta con successo`, data: entrataSalvata });
  } catch (err) {
    console.error("❌ Errore nel salvataggio dell'entrata:", err);
    res.status(500).json({ error: "Errore nel salvataggio", message: "Non è stato possibile salvare l'entrata. Riprova." });
  }
});

// PUT /api/entrate/:id
app.put('/api/entrate/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { importo, descrizione, categoria, data } = req.body;
    if (!importo || !categoria) return res.status(400).json({ error: "Importo e categoria sono richiesti" });
    const importoNumerico = Number(importo);
    if (isNaN(importoNumerico)) return res.status(400).json({ error: "L'importo deve essere un numero valido" });
    // Ensure the user can only update their own income
    const entrata = await Entrata.findOneAndUpdate(
        { _id: id, user: req.user.userId }, 
        { descrizione: descrizione || '', importo: Math.abs(importoNumerico), categoria, data: data ? new Date(data) : undefined }, 
        { new: true }
    );
    if (!entrata) return res.status(404).json({ error: "Entrata non trovata o non autorizzato" });
    res.json(entrata);
  } catch (err) {
    console.error("❌ Errore nella modifica dell'entrata:", err);
    res.status(500).json({ error: "Errore nella modifica dell'entrata" });
  }
});

// DELETE /api/entrate/:id
app.delete('/api/entrate/:id', authenticateToken, async (req, res) => {
  console.log('🗑️ Richiesta eliminazione entrata:', req.params.id);
  try {
    // Ensure the user can only delete their own income
    const entrata = await Entrata.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
    if (!entrata) return res.status(404).json({ error: "Entrata non trovata o non autorizzato" });
    console.log('✅ Entrata eliminata con successo:', req.params.id);
    res.json({ message: "Entrata eliminata con successo" });
  } catch (err) {
    console.error("❌ Errore nella cancellazione dell'entrata:", err);
    res.status(500).json({ error: "Errore nella cancellazione dell'entrata" });
  }
});

// POST /api/fix-transactions
app.post('/api/fix-transactions', authenticateToken, async (req, res) => {
  try {
    const spese = await Spesa.find({ user: req.user.userId }); // Filter by user
    console.log(`Trovate ${spese.length} spese da sistemare per l'utente ${req.user.userId}`);
    for (const spesa of spese) { 
        if (spesa.importo > 0) { // Fix only if positive
            spesa.importo = -Math.abs(spesa.importo); 
            await spesa.save(); 
        }
    }
    const entrate = await Entrata.find({ user: req.user.userId }); // Filter by user
    console.log(`Trovate ${entrate.length} entrate da sistemare per l'utente ${req.user.userId}`);
    for (const entrata of entrate) { 
        if (entrata.importo < 0) { // Fix only if negative
            entrata.importo = Math.abs(entrata.importo); 
            await entrata.save(); 
        }
    }
    res.json({ success: true, message: `Controllo transazioni completato per l'utente ${req.user.userId}.` });
  } catch (err) {
    console.error('❌ Errore nella correzione delle transazioni:', err);
    res.status(500).json({ error: "Errore nella correzione delle transazioni" });
  }
});

// GET / (Root Test Route)
app.get('/', (req, res) => {
  res.send('✅ Backend Budget App attivo!');
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username e password sono richiesti" });
    }
    if (password.length < 6) { // Simple password policy example
        return res.status(400).json({ message: "La password deve essere almeno 6 caratteri" });
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: "Username già in uso" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: "Utente registrato con successo" });
  } catch (error) {
    console.error('❌ Errore durante la registrazione:', error);
    res.status(500).json({ message: "Errore durante la registrazione" });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username e password sono richiesti" });
    }
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Credenziali non valide" });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: "Credenziali non valide" });
    
    // Generate token with user ID
    const token = jwt.sign(
        { userId: user._id, username: user.username }, 
        process.env.JWT_SECRET || 'your-secret-key', 
        { expiresIn: '24h' } // Token expires in 24 hours
    );
    console.log(`✅ Utente ${user.username} (ID: ${user._id}) loggato con successo.`);
    res.json({ token });
  } catch (error) {
    console.error('❌ Errore durante il login:', error);
    res.status(500).json({ message: "Errore durante il login" });
  }
});

// Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server in ascolto sulla porta ${PORT}`);
});
