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
const crypto = require('crypto');

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
  try {
    const { anno, mese } = req.query;
    console.log('Ricevuta richiesta GET budget settings:', { anno, mese });

    if (!anno) {
      return res.status(400).json({ message: "Anno è richiesto" });
    }

    const query = {
      anno: parseInt(anno)
    };

    // If mese is provided and is a valid number (0-11), search for monthly settings.
    // Otherwise, search for yearly settings (mese: null).
    const meseInt = parseInt(mese);
    if (!isNaN(meseInt) && meseInt >= 0 && meseInt <= 11) {
        query.mese = meseInt;
        console.log('Cercando impostazioni MENSILI con query:', query);
    } else {
        query.mese = null; // Use null to find the yearly setting
        console.log('Cercando impostazioni ANNUALI con query:', query);
    }

    const settings = await BudgetSettings.findOne(query);
    
    if (!settings) {
      console.log('Nessuna impostazione trovata, restituisco oggetto vuoto');
      // Return empty structure if no settings found for that year/month
      return res.json({
        spese: {},
        entrate: {}
      }); 
    }

    // Convert Map to plain object for JSON response
    const result = {
      spese: Object.fromEntries(settings.spese),
      entrate: Object.fromEntries(settings.entrate)
    };

    console.log('Invio risultato:', result);
    res.json(result);

  } catch (error) {
    console.error('Errore nel recupero delle impostazioni del budget:', error);
    res.status(500).json({ message: "Errore nel recupero delle impostazioni del budget" });
  }
});

// POST Budget Settings (Handles Monthly and Yearly)
app.post('/api/budget-settings', authenticateToken, async (req, res) => {
  try {
    const { anno, mese, isYearly, settings } = req.body; // Add isYearly flag
    console.log('Ricevuta richiesta POST budget settings:', { anno, mese, isYearly, settings });

    if (!anno || !settings) { // Mese is optional now, check isYearly instead
      return res.status(400).json({ message: "Anno e settings sono richiesti" });
    }
    if (settings.spese === undefined || settings.entrate === undefined) {
      return res.status(400).json({ message: "La struttura dei dati (settings.spese/entrate) non è corretta" });
    }
    
    const annoInt = parseInt(anno);
    let meseValue = null; // Default to null for yearly

    // If not yearly, validate and parse the month
    if (!isYearly) {
        if (mese === undefined || mese === null) {
             return res.status(400).json({ message: "Mese è richiesto per impostazioni mensili" });
        }
        const meseInt = parseInt(mese);
        if (isNaN(meseInt) || meseInt < 0 || meseInt > 11) {
            return res.status(400).json({ message: "Mese non valido (deve essere 0-11)" });
        }
        meseValue = meseInt;
    }

    // Prepare data for saving
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

    const updateData = { 
        anno: annoInt,
        mese: meseValue, 
        spese,
        entrate
    };
    
    console.log('Salvando/Aggiornando le impostazioni con:', updateData);

    // Find and update (or create if not found - upsert)
    const result = await BudgetSettings.findOneAndUpdate(
      { anno: annoInt, mese: meseValue }, // Query condition
      updateData, // Data to set
      { new: true, upsert: true, setDefaultsOnInsert: true } // Options
    );

    // Convert Map back to plain object for response
    const response = {
      spese: Object.fromEntries(result.spese),
      entrate: Object.fromEntries(result.entrate)
    };

    console.log('Invio risposta:', response);
    res.json(response);

  } catch (error) {
    console.error('Errore nel salvataggio delle impostazioni del budget:', error);
    // Handle potential duplicate key error during upsert if needed
    if (error.code === 11000) {
         return res.status(409).json({ message: "Errore: impostazione duplicata rilevata." });
    }
    res.status(500).json({ message: "Errore nel salvataggio delle impostazioni del budget" });
  }
});


// --- Other Routes (Spese, Entrate, Auth) ---

// GET /api/spese (Paginated)
app.get('/api/spese', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const totalSpese = await Spesa.countDocuments();
    const spese = await Spesa.find().sort({ data: -1 }).skip(skip).limit(limit);
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
    const spese = await Spesa.find({ data: { $gte: inizioMese, $lte: fineMese } });
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
    const nuovaSpesa = new Spesa({ descrizione: descrizione || '', importo: -Math.abs(importoNumerico), categoria, data: data ? new Date(data) : new Date() });
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
    const spesa = await Spesa.findByIdAndDelete(req.params.id);
    if (!spesa) return res.status(404).json({ error: "Spesa non trovata" });
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
  try {
    const spesa = await Spesa.findByIdAndUpdate(id, { descrizione, importo: Number(importo), categoria, data: data ? new Date(data) : undefined }, { new: true });
    if (!spesa) return res.status(404).json({ error: "Spesa non trovata" });
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
    const totalEntrate = await Entrata.countDocuments();
    const entrate = await Entrata.find().sort({ data: -1 }).skip(skip).limit(limit);
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
    const entrate = await Entrata.find({ data: { $gte: inizioMese, $lte: fineMese } });
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
    const nuovaEntrata = new Entrata({ descrizione: descrizione || '', importo: Math.abs(importoNumerico), categoria, data: data ? new Date(data) : new Date() });
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
    const entrata = await Entrata.findByIdAndUpdate(id, { descrizione: descrizione || '', importo: Math.abs(importoNumerico), categoria, data: data ? new Date(data) : undefined }, { new: true });
    if (!entrata) return res.status(404).json({ error: "Entrata non trovata" });
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
    const entrata = await Entrata.findByIdAndDelete(req.params.id);
    if (!entrata) return res.status(404).json({ error: "Entrata non trovata" });
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
    const spese = await Spesa.find();
    console.log(`Trovate ${spese.length} spese da sistemare`);
    for (const spesa of spese) { spesa.importo = -Math.abs(spesa.importo); await spesa.save(); }
    const entrate = await Entrata.find();
    console.log(`Trovate ${entrate.length} entrate da sistemare`);
    for (const entrata of entrate) { entrata.importo = Math.abs(entrata.importo); await entrata.save(); }
    res.json({ success: true, message: `Sistemate ${spese.length} spese e ${entrate.length} entrate` });
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
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Credenziali non valide" });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: "Credenziali non valide" });
    const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
    res.json({ token });
  } catch (error) {
    console.error('❌ Errore durante il login:', error);
    res.status(500).json({ message: "Errore durante il login" });
  }
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Password attuale e nuova password sono richieste" });
    }
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "Utente non trovato" });
    }
    
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Password attuale non corretta" });
    }
    
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();
    
    res.json({ message: "Password cambiata con successo" });
  } catch (error) {
    console.error('❌ Errore durante il cambio password:', error);
    res.status(500).json({ message: "Errore durante il cambio password" });
  }
});

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: "Username è richiesto" });
    }
    
    const user = await User.findOne({ username });
    if (!user) {
      // Per sicurezza, non rivelare se l'utente esiste o meno
      return res.json({ message: "Se l'utente esiste, riceverai le istruzioni per il reset" });
    }
    
    // Genera token di reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 ora
    await user.save();
    
    // In un'app reale, qui invieresti un'email con il link di reset
    // Per ora, restituiamo il token (solo per sviluppo)
    console.log(`Token di reset per ${username}: ${resetToken}`);
    
    res.json({ 
      message: "Se l'utente esiste, riceverai le istruzioni per il reset",
      // Rimuovi questa riga in produzione:
      resetToken: resetToken 
    });
  } catch (error) {
    console.error('❌ Errore durante il reset password:', error);
    res.status(500).json({ message: "Errore durante il reset password" });
  }
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token e nuova password sono richiesti" });
    }
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: "Token non valido o scaduto" });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    res.json({ message: "Password reimpostata con successo" });
  } catch (error) {
    console.error('❌ Errore durante il reset password:', error);
    res.status(500).json({ message: "Errore durante il reset password" });
  }
});

// ... existing code ...
