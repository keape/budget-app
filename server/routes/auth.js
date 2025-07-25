const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
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
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Credenziali non valide" });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: "Credenziali non valide" });
    const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } catch (error) {
    console.error('❌ Errore durante il login:', error);
    res.status(500).json({ message: "Errore durante il login" });
  }
});

// Middleware per l'autenticazione JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token di accesso richiesto' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token non valido' });
    }
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