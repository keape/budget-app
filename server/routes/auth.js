const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const BudgetSettings = require('../models/BudgetSettings');
const TransazionePeriodica = require('../models/TransazionePeriodica');
const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Inizio registrazione');
    console.log('🔍 DEBUG: Dati ricevuti:', req.body);

    const { username, password, email } = req.body;

    // Validazione input
    if (!username || !password) {
      console.log('❌ DEBUG: Dati mancanti - username:', username, 'password:', !!password);
      return res.status(400).json({ message: "Username e password sono richiesti" });
    }

    console.log('🔍 DEBUG: Controllo utente esistente per username:', username);
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      console.log('❌ DEBUG: Username già esistente:', username);
      return res.status(400).json({ message: "Username già in uso" });
    }

    console.log('🔍 DEBUG: Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ DEBUG: Password hashata con successo');

    console.log('🔍 DEBUG: Creazione nuovo utente...');
    const user = new User({ username, password: hashedPassword, email });

    console.log('🔍 DEBUG: Salvataggio utente nel database...');
    await user.save();
    console.log('✅ DEBUG: Utente salvato con successo, ID:', user._id);

    // CREATE DEFAULT BUDGET SETTINGS
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-11

      console.log(`✨ CREATING DEFAULT BUDGET for ${username} (${currentMonth}/${currentYear})`);

      const defaultSpese = {
        "Home": 0,
        "Vacation": 0,
        "Car": 0,
        "Mortgage": 0 // Corrected 'Mortage' to 'Mortgage'
      };

      const defaultEntrate = {
        "Salary": 0,
        "MBO": 0,
        "Welfare": 0
      };

      const defaultBudget = {
        userId: user._id,
        anno: currentYear,
        mese: currentMonth,
        spese: defaultSpese,
        entrate: defaultEntrate,
        createdAt: now,
        updatedAt: now
      };

      // Use budgetsettings_new directly to match the rest of the app
      await mongoose.connection.db.collection('budgetsettings_new').insertOne(defaultBudget);
      console.log('✅ DEBUG: Default budget settings created successfully');

    } catch (budgetError) {
      console.error('⚠️ Warning: Failed to create default budget:', budgetError);
      // We don't fail registration if this fails, just log it
    }

    res.status(201).json({ message: "Utente registrato con successo" });
  } catch (error) {
    console.error('❌ Errore durante la registrazione:', error);
    console.error('❌ Stack trace completo:', error.stack);
    console.error('❌ Tipo errore:', error.name);
    console.error('❌ Messaggio errore:', error.message);
    res.status(500).json({ message: "Errore durante la registrazione", error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('🔍 LOGIN tentativo per username:', username);

    const user = await User.findOne({ username });
    if (!user) {
      console.log('❌ LOGIN: Utente non trovato:', username);
      return res.status(401).json({ message: "Credenziali non valide" });
    }

    console.log('🔍 LOGIN: Utente trovato, verifica password...');
    console.log('🔍 LOGIN: User data:', {
      id: user._id,
      username: user.username,
      idType: typeof user._id,
      idString: user._id.toString(),
      usernameLength: user.username.length,
      usernameChars: user.username.split('').map(c => c.charCodeAt(0))
    });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('❌ LOGIN: Password non valida per:', username);
      return res.status(401).json({ message: "Credenziali non valide" });
    }

    console.log('✅ LOGIN: Password valida, generazione token...');
    const tokenPayload = { userId: user._id, username: user.username };
    console.log('🔍 LOGIN: Token payload:', tokenPayload);

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
    console.log('✅ LOGIN: Token generato, lunghezza:', token.length);

    // Test immediato del token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ LOGIN: Token verificato subito:', decoded);
    } catch (verifyError) {
      console.error('❌ LOGIN: Token appena generato non valido!', verifyError);
    }

    res.json({ token });
  } catch (error) {
    console.error('❌ Errore durante il login:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      message: "Errore durante il login",
      error: error.message,
      errorType: error.name
    });
  }
});

// Middleware per l'autenticazione JWT
const authenticateToken = (req, res, next) => {
  console.log('🔐 AUTHENTICATETOKEN START - headers:', req.headers['authorization'] ? 'PRESENTE' : 'MANCANTE');

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('❌ TOKEN MANCANTE');
    return res.status(401).json({ message: 'Token di accesso richiesto' });
  }

  console.log('🔍 TOKEN PRESENTE, verifica in corso...');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ TOKEN NON VALIDO:', err.message);
      return res.status(403).json({ message: 'Token non valido' });
    }

    console.log('✅ TOKEN VALIDO - User data:', user);
    console.log('🆔 USER ID ESTRATTO:', user.userId);
    console.log('👤 USERNAME ESTRATTO:', user.username);

    req.user = user;
    next();
  });
};

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
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

// DELETE /api/auth/delete-account
router.delete('/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`⚠️ Richiesta cancellazione account per user ID: ${userId}`);

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utente non trovato" });
    }

    // Delete all related data
    console.log(`🗑️ Eliminazione dati associati...`);
    const deleteSpese = await Spesa.deleteMany({ userId });
    console.log(`- Spese eliminate: ${deleteSpese.deletedCount}`);

    const deleteEntrate = await Entrata.deleteMany({ userId });
    console.log(`- Entrate eliminate: ${deleteEntrate.deletedCount}`);

    const deleteBudget = await BudgetSettings.deleteMany({ userId });
    console.log(`- BudgetSettings eliminati: ${deleteBudget.deletedCount}`);

    const deletePeriodiche = await TransazionePeriodica.deleteMany({ userId });
    console.log(`- Transazioni periodiche eliminate: ${deletePeriodiche.deletedCount}`);

    // Delete User
    await User.findByIdAndDelete(userId);
    console.log(`✅ Utente ${userId} eliminato con successo`);

    res.json({ message: "Account e tutti i dati associati cancellati con successo" });
  } catch (error) {
    console.error('❌ Errore durante cancellazione account:', error);
    res.status(500).json({ message: "Errore durante la cancellazione dell'account" });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
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

    console.log(`Token di reset per ${username}: ${resetToken}`);

    res.json({
      message: "Se l'utente esiste, riceverai le istruzioni per il reset"
    });
  } catch (error) {
    console.error('❌ Errore durante il reset password:', error);
    res.status(500).json({ message: "Errore durante il reset password" });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
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

module.exports = { router, authenticateToken };