const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// Import routes
const { router: authRoutes } = require('./routes/auth');
const speseRoutes = require('./routes/spese');
const entrateRoutes = require('./routes/entrate');
const budgetSettingsRoutes = require('./routes/budgetSettings');

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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/spese', speseRoutes);
app.use('/api/entrate', entrateRoutes);
app.use('/api/budget-settings', budgetSettingsRoutes);

// Root test route
app.get('/', (req, res) => {
  res.send('✅ Backend Budget App attivo!');
});

// Additional utility routes
const Spesa = require('./models/Spesa');
const Entrata = require('./models/Entrata');
const { authenticateToken } = require('./routes/auth');

// POST /api/fix-transactions
app.post('/api/fix-transactions', authenticateToken, async (req, res) => {
  try {
    const spese = await Spesa.find();
    console.log(`Trovate ${spese.length} spese da sistemare`);
    for (const spesa of spese) { 
      spesa.importo = -Math.abs(spesa.importo); 
      await spesa.save(); 
    }
    const entrate = await Entrata.find();
    console.log(`Trovate ${entrate.length} entrate da sistemare`);
    for (const entrata of entrate) { 
      entrata.importo = Math.abs(entrata.importo); 
      await entrata.save(); 
    }
    res.json({ success: true, message: `Sistemate ${spese.length} spese e ${entrate.length} entrate` });
  } catch (err) {
    console.error('❌ Errore nella correzione delle transazioni:', err);
    res.status(500).json({ error: "Errore nella correzione delle transazioni" });
  }
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connessione a MongoDB riuscita');
  })
  .catch((error) => {
    console.error('❌ Errore di connessione a MongoDB:', error);
  });

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server in esecuzione sulla porta ${PORT}`);
});