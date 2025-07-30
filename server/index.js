const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// Import routes
const { router: authRoutes } = require('./routes/auth');
const speseRoutes = require('./routes/spese');
const entrateRoutes = require('./routes/entrate');
const budgetSettingsRoutes = require('./routes/budgetSettings');
const categorieRoutes = require('./routes/categorie');
const transazioniPeriodicheRoutes = require('./routes/transazioniPeriodiche');

const app = express();

// CORS Configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://budget-app-ao5r.onrender.com',
    'https://budget-app-cd5o.onrender.com',
    'https://budget-app-keape.vercel.app',
    'https://budget-app-three-gules.vercel.app',
    'https://budget-app-backend.onrender.com',
    'https://9000-idx-budget-app-1745625859888.cluster-jbb3mjctu5cbgsi6hwq6u4bt.cloudworkstations.dev'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Authorization']
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JSON Response Middleware - Force Content-Type to application/json for API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Database check middleware - Allow auth endpoints to work without DB check
app.use('/api', (req, res, next) => {
  // Skip database check for health endpoint and auth endpoints
  if (req.path === '/health' || req.path === '/auth/login' || req.path === '/auth/register') {
    return next();
  }
  
  // For other endpoints, let them handle DB errors gracefully
  next();
});

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

// Health check endpoint - must be before database middleware
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    server: 'running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// DEBUG: Check environment variables
app.get('/api/debug-env', (req, res) => {
  res.json({
    hasMongodbUri: !!process.env.MONGODB_URI,
    hasJwtSecret: !!process.env.JWT_SECRET,
    mongodbUriLength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
    mongodbUriStart: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 30) + '...' : 'MISSING'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/spese', speseRoutes);
app.use('/api/entrate', entrateRoutes);
app.use('/api/budget-settings', budgetSettingsRoutes);
app.use('/api/categorie', categorieRoutes);
app.use('/api/transazioni-periodiche', transazioniPeriodicheRoutes);

// Root test route
app.get('/', (req, res) => {
  res.send('✅ Backend Budget App attivo! v1.2 - Fixed imports');
});

// MIGRATION: Copy data from old to new collection
app.all('/api/migrate-budget-data', async (req, res) => {
  try {
    console.log('🚀 MIGRATING: Copying data from old to new collection');
    const mongoose = require('mongoose');
    
    // Ensure connection is ready
    if (!mongoose.connection.db) {
      throw new Error('Database connection not ready');
    }
    
    const oldCollection = mongoose.connection.db.collection('budgetsettings');
    const newCollection = mongoose.connection.db.collection('budgetsettings_new');
    
    // Get all documents from old collection
    const oldDocs = await oldCollection.find({}).toArray();
    console.log(`📋 Found ${oldDocs.length} documents in old collection`);
    
    let migratedCount = 0;
    
    for (const doc of oldDocs) {
      try {
        // Convert Maps to objects if needed
        const newDoc = {
          userId: doc.userId,
          anno: doc.anno,
          mese: doc.mese,
          spese: doc.spese instanceof Map ? Object.fromEntries(doc.spese) : (doc.spese || {}),
          entrate: doc.entrate instanceof Map ? Object.fromEntries(doc.entrate) : (doc.entrate || {}),
          createdAt: doc.createdAt || new Date(),
          updatedAt: new Date()
        };
        
        // Insert into new collection (replace if exists)
        await newCollection.replaceOne(
          { userId: doc.userId, anno: doc.anno, mese: doc.mese },
          newDoc,
          { upsert: true }
        );
        
        migratedCount++;
      } catch (docError) {
        console.error('❌ Error migrating document:', doc._id, docError.message);
      }
    }
    
    console.log(`✅ Migration completed: ${migratedCount}/${oldDocs.length} documents migrated`);
    
    res.json({
      success: true,
      message: 'Data migration completed',
      totalDocuments: oldDocs.length,
      migratedDocuments: migratedCount
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DEBUG: View migrated data
app.all('/api/debug-budget-data', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    if (!mongoose.connection.db) {
      throw new Error('Database connection not ready');
    }
    
    const newCollection = mongoose.connection.db.collection('budgetsettings_new');
    
    // Get all documents from new collection
    const docs = await newCollection.find({}).toArray();
    
    // Group by user for easier reading
    const userGroups = {};
    docs.forEach(doc => {
      const userId = doc.userId ? doc.userId.toString() : 'unknown';
      if (!userGroups[userId]) userGroups[userId] = [];
      userGroups[userId].push({
        anno: doc.anno,
        mese: doc.mese,
        spese: doc.spese,
        entrate: doc.entrate,
        speseCount: Object.keys(doc.spese || {}).length,
        entrateCount: Object.keys(doc.entrate || {}).length
      });
    });
    
    res.json({
      success: true,
      totalDocuments: docs.length,
      userGroups: userGroups
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// EMERGENCY: Remove unique index directly - BOTH GET AND POST  
app.all('/api/emergency-remove-index', async (req, res) => {
  try {
    console.log('🚨 EMERGENCY: Removing unique index from database');
    const BudgetSettings = require('./models/BudgetSettings');
    
    // Get the collection directly
    const collection = BudgetSettings.collection;
    
    // Try to drop the problematic unique index directly
    try {
      await collection.dropIndex({ userId: 1, anno: 1, mese: 1 });
      console.log('✅ Unique index dropped successfully');
    } catch (dropError) {
      console.log('⚠️ Index drop attempt:', dropError.message);
      // Try alternative index names
      try {
        await collection.dropIndex('userId_1_anno_1_mese_1');
        console.log('✅ Named index dropped successfully');
      } catch (dropError2) {
        console.log('⚠️ Named index drop attempt:', dropError2.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Index removal attempts completed - check logs for results'
    });
    
  } catch (error) {
    console.error('❌ Emergency index removal failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// Additional utility routes
const Spesa = require('./models/Spesa');
const Entrata = require('./models/Entrata');
const { authenticateToken } = require('./routes/auth');

// TEST ENDPOINT - per verificare autenticazione per tutti gli utenti
app.post('/api/test-auth', authenticateToken, (req, res) => {
  console.log('🧪 TEST AUTH - Utente:', req.user.username, 'ID:', req.user.userId);
  res.json({
    message: 'Autenticazione riuscita',
    user: {
      username: req.user.username,
      userId: req.user.userId
    },
    timestamp: new Date().toISOString()
  });
});

// POST /api/fix-transactions
app.post('/api/fix-transactions', authenticateToken, async (req, res) => {
  try {
    const userFilter = { userId: req.user.userId };
    const spese = await Spesa.find(userFilter);
    console.log(`Trovate ${spese.length} spese da sistemare per utente ${req.user.userId}`);
    for (const spesa of spese) { 
      spesa.importo = -Math.abs(spesa.importo); 
      await spesa.save(); 
    }
    const entrate = await Entrata.find(userFilter);
    console.log(`Trovate ${entrate.length} entrate da sistemare per utente ${req.user.userId}`);
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

// Error handling middleware - must be after all routes
app.use((err, req, res, next) => {
  console.error('❌ Error caught by middleware:', err);
  
  // Set proper JSON content type
  res.setHeader('Content-Type', 'application/json');
  
  // Handle different error types
  if (err.name === 'MongoServerError' || err.name === 'MongoError') {
    return res.status(500).json({
      success: false,
      error: 'Database connection error',
      message: 'Unable to connect to database. Please try again later.'
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: err.message
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication error',
      message: 'Invalid token'
    });
  }
  
  // Generic error handler
  res.status(err.status || 500).json({
    success: false,
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `API endpoint ${req.originalUrl} not found`
  });
});

// MongoDB connection with better error handling
let isDbConnected = false;

// Clean MONGODB_URI of any quotes that Render might add
const mongoUri = process.env.MONGODB_URI?.replace(/^["']|["']$/g, '');
console.log('🔧 Cleaned MongoDB URI length:', mongoUri?.length);

mongoose.connect(mongoUri)
  .then(() => {
    console.log('✅ Connessione a MongoDB riuscita');
    isDbConnected = true;
  })
  .catch((error) => {
    console.error('❌ Errore di connessione a MongoDB:', error.message);
    console.log('⚠️ Server will continue without database connection');
    isDbConnected = false;
  });

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server in esecuzione sulla porta ${PORT}`);
});