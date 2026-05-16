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
const Otp = require('../models/Otp');
const nodemailer = require('nodemailer');
const { debugLog, logError } = require('../utils/logger');
const router = express.Router();

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail', // Default to gmail if not specified
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Helper function to send email
const sendEmail = async (to, subject, text) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text
  };

  try {
    await transporter.sendMail(mailOptions);
    debugLog(`📧 Email sent to ${to}`);
    return true;
  } catch (error) {
    logError('❌ Error sending email:', error);
    return false;
  }
};

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if email is already in use
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to database (upsert to replace existing OTP for same email)
    await Otp.findOneAndUpdate(
      { email },
      { otp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // Send OTP via email
    const emailSent = await sendEmail(
      email,
      'Budget365 - Verification Code',
      `Your verification code is: ${otp}\n\nThis code will expire in 5 minutes.`
    );

    if (emailSent) {
      res.json({ message: "Verification code sent" });
    } else {
      // If email fails (e.g. no config), we might want to fail or return it in dev mode
      // For now, fail
      res.status(500).json({ message: "Failed to send verification email. Please contact support." });
    }

  } catch (error) {
    logError('❌ Error sending OTP:', error);
    res.status(500).json({ message: "Error sending verification code" });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    debugLog('🔍 DEBUG: Inizio registrazione');
    debugLog('🔍 DEBUG: Dati ricevuti:', req.body);

    const { username, password, email, otp } = req.body;

    // Validazione input
    if (!username || !password || !email || !otp) {
      debugLog('❌ DEBUG: Dati mancanti - username:', username, 'email:', email, 'password:', !!password, 'otp:', !!otp);
      return res.status(400).json({ message: "Username, email, password and OTP are required" });
    }

    // Verify OTP
    const validOtp = await Otp.findOne({ email, otp });
    if (!validOtp) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    debugLog('🔍 DEBUG: Controllo utente esistente...');
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      debugLog('❌ DEBUG: Username già esistente:', username);
      return res.status(400).json({ message: "Username già in uso" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      debugLog('❌ DEBUG: Email già esistente:', email);
      return res.status(400).json({ message: "Email già in uso" });
    }

    debugLog('🔍 DEBUG: Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    debugLog('✅ DEBUG: Password hashata con successo');

    debugLog('🔍 DEBUG: Creazione nuovo utente...');
    const user = new User({ username, password: hashedPassword, email, emailVerified: true });

    debugLog('🔍 DEBUG: Salvataggio utente nel database...');
    await user.save();
    debugLog('✅ DEBUG: Utente salvato con successo, ID:', user._id);

    // CREATE DEFAULT BUDGET SETTINGS
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-11

      debugLog(`✨ CREATING DEFAULT BUDGET for ${username} (${currentMonth}/${currentYear})`);

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
        userId: user._id.toString(), // Store as string for consistency with native driver usage
        anno: currentYear,
        mese: currentMonth,
        spese: defaultSpese,
        entrate: defaultEntrate,
        createdAt: now,
        updatedAt: now
      };

      // Use budgetsettings_new directly to match the rest of the app
      await mongoose.connection.db.collection('budgetsettings_new').insertOne(defaultBudget);
      debugLog('✅ DEBUG: Default budget settings created successfully');

    } catch (budgetError) {
      logError('⚠️ Warning: Failed to create default budget:', budgetError);
      // We don't fail registration if this fails, just log it
    }

    // Delete OTP after successful registration
    await Otp.deleteOne({ email });

    res.status(201).json({ message: "Utente registrato con successo" });
  } catch (error) {
    logError('❌ Errore durante la registrazione:', error);
    res.status(500).json({
      message: "Errore durante la registrazione",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // 'identifier' can be email or username
    debugLog('🔍 LOGIN tentativo per identifier:', identifier);

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }]
    });

    if (!user) {
      debugLog('❌ LOGIN: Utente non trovato:', identifier);
      return res.status(401).json({ message: "Credenziali non valide" });
    }

    debugLog('🔍 LOGIN: Utente trovato, verifica password...');
    debugLog('🔍 LOGIN: User data:', {
      id: user._id,
      username: user.username,
      idType: typeof user._id,
      idString: user._id.toString(),
      usernameLength: user.username.length,
      usernameChars: user.username.split('').map(c => c.charCodeAt(0))
    });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      debugLog('❌ LOGIN: Password non valida per:', identifier);
      return res.status(401).json({ message: "Credenziali non valide" });
    }

    debugLog('✅ LOGIN: Password valida, generazione token...');
    const tokenPayload = { userId: user._id, username: user.username };
    debugLog('🔍 LOGIN: Token payload:', tokenPayload);

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
    debugLog('✅ LOGIN: Token generato, lunghezza:', token.length);

    // Test immediato del token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      debugLog('✅ LOGIN: Token verificato subito:', decoded);
    } catch (verifyError) {
      logError('❌ LOGIN: Token appena generato non valido!', verifyError);
    }

    res.json({ token });
  } catch (error) {
    logError('❌ Errore durante il login:', error);
    res.status(500).json({
      message: "Errore durante il login",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      errorType: process.env.NODE_ENV === 'development' ? error.name : undefined
    });
  }
});

// Middleware per l'autenticazione JWT
const authenticateToken = (req, res, next) => {
  debugLog('🔐 AUTHENTICATETOKEN START - headers:', req.headers['authorization'] ? 'PRESENTE' : 'MANCANTE');

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    debugLog('❌ TOKEN MANCANTE');
    return res.status(401).json({ message: 'Token di accesso richiesto' });
  }

  debugLog('🔍 TOKEN PRESENTE, verifica in corso...');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      debugLog('❌ TOKEN NON VALIDO:', err.message);
      return res.status(403).json({ message: 'Token non valido' });
    }

    debugLog('✅ TOKEN VALIDO - User data:', user);
    debugLog('🆔 USER ID ESTRATTO:', user.userId);
    debugLog('👤 USERNAME ESTRATTO:', user.username);

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
    logError('❌ Errore durante il cambio password:', error);
    res.status(500).json({ message: "Errore durante il cambio password" });
  }
});

// POST /api/auth/social-login
router.post('/social-login', async (req, res) => {
  try {
    const { provider, token, idToken, user: socialUser } = req.body;
    let socialId, email, name;

    if (provider === 'google') {
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      if (!googleRes.ok) {
        throw new Error(`Google API error: ${googleRes.statusText}`);
      }
      const googleData = await googleRes.json();
      socialId = googleData.sub;
      email = googleData.email;
      name = googleData.name;
    } else if (provider === 'apple') {
      // NOTE: In production, verify idToken signature with Apple Public Keys
      const decoded = jwt.decode(idToken);
      socialId = decoded.sub;
      email = decoded.email;
      // Apple only sends name on the first login in the 'user' object from RN
      name = socialUser?.name?.firstName ? `${socialUser.name.firstName} ${socialUser.name.lastName}` : email;
    } else {
      return res.status(400).json({ message: "Provider non supportato" });
    }

    if (!socialId) {
      return res.status(400).json({ message: "Impossibile ottenere ID social" });
    }

    // Cerca utente per ID Social o Email
    let user = await User.findOne({
      $or: [
        { googleId: provider === 'google' ? socialId : undefined },
        { appleId: provider === 'apple' ? socialId : undefined },
        { email: email && email !== '' ? email : '___invalid_email___' }
      ].filter(q => Object.values(q)[0] !== undefined)
    });

    if (!user) {
      // Crea nuovo utente
      const tempPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Genera username univoco basato su email o nome
      let baseUsername = email ? email.split('@')[0] : (name ? name.replace(/\s/g, '').toLowerCase() : 'user');
      let username = baseUsername;
      let counter = 1;
      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      user = new User({
        username,
        email,
        password: hashedPassword,
        emailVerified: true,
        googleId: provider === 'google' ? socialId : undefined,
        appleId: provider === 'apple' ? socialId : undefined
      });
      await user.save();

      // Crea budget di default
      try {
        const now = new Date();
        const defaultBudget = {
          userId: user._id.toString(),
          anno: now.getFullYear(),
          mese: now.getMonth(),
          spese: { "Home": 0, "Vacation": 0, "Car": 0, "Mortgage": 0 },
          entrate: { "Salary": 0, "MBO": 0, "Welfare": 0 },
          createdAt: now,
          updatedAt: now
        };
        await mongoose.connection.db.collection('budgetsettings_new').insertOne(defaultBudget);
      } catch (e) { logError('Default budget skip:', e); }

    } else {
      // Aggiorna ID social se non presente
      if (provider === 'google' && !user.googleId) {
        user.googleId = socialId;
        await user.save();
      } else if (provider === 'apple' && !user.appleId) {
        user.appleId = socialId;
        await user.save();
      }
    }

    const jwtToken = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token: jwtToken, username: user.username });

  } catch (error) {
    logError('❌ Social Login Error:', error.response?.data || error);
    res.status(500).json({ message: "Errore durante il social login" });
  }
});

// POST /api/auth/update-email
router.post('/update-email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.userId;

    if (!email) {
      return res.status(400).json({ message: "Email è richiesta" });
    }

    // Verifica se l'email è già in uso da un ALTRO utente
    const existingUser = await User.findOne({ email, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(400).json({ message: "Email già in uso da un altro account" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utente non trovato" });
    }

    user.email = email;
    await user.save();

    res.json({ message: "Email aggiornata con successo" });
  } catch (error) {
    logError('❌ Errore durante l\'aggiornamento email:', error);
    res.status(500).json({ message: "Errore durante l'aggiornamento dell'email" });
  }
});

// DELETE /api/auth/delete-account
router.delete('/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    debugLog(`⚠️ Richiesta cancellazione account per user ID: ${userId}`);

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utente non trovato" });
    }

    // Delete all related data
    debugLog(`🗑️ Eliminazione dati associati...`);
    const deleteSpese = await Spesa.deleteMany({ userId });
    debugLog(`- Spese eliminate: ${deleteSpese.deletedCount}`);

    const deleteEntrate = await Entrata.deleteMany({ userId });
    debugLog(`- Entrate eliminate: ${deleteEntrate.deletedCount}`);

    const deleteBudget = await BudgetSettings.deleteMany({ userId });
    debugLog(`- BudgetSettings eliminati: ${deleteBudget.deletedCount}`);

    const deletePeriodiche = await TransazionePeriodica.deleteMany({ userId });
    debugLog(`- Transazioni periodiche eliminate: ${deletePeriodiche.deletedCount}`);

    // Delete User
    await User.findByIdAndDelete(userId);
    debugLog(`✅ Utente ${userId} eliminato con successo`);

    res.json({ message: "Account e tutti i dati associati cancellati con successo" });
  } catch (error) {
    logError('❌ Errore durante cancellazione account:', error);
    res.status(500).json({ message: "Errore durante la cancellazione dell'account" });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body; // Can be username or email

    if (!identifier) {
      return res.status(400).json({ message: "Identificativo (Email o Username) è richiesto" });
    }

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }]
    });
    if (!user) {
      // Per sicurezza, non rivelare se l'utente esiste o meno
      return res.json({ message: "Se l'utente esiste, riceverai le istruzioni per il reset" });
    }

    // Genera token di reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 ora
    await user.save();

    // Invia email con link di reset
    const resetUrl = `${process.env.FRONTEND_URL || 'https://budget-app-keape.vercel.app'}/reset-password?token=${resetToken}`;
    const emailSent = await sendEmail(
      user.email,
      'Budget365 - Reset Password',
      `Hai richiesto il reset della password.\n\nClicca sul link per reimpostarla:\n${resetUrl}\n\nIl link scade tra 1 ora.\n\nSe non hai richiesto il reset, ignora questa email.`
    );

    if (!emailSent) {
      debugLog('⚠️ Forgot-password: reset token salvato ma email non inviata');
    }

    res.json({
      message: "Se l'utente esiste, riceverai le istruzioni per il reset"
    });
  } catch (error) {
    logError('❌ Errore durante il reset password:', error);
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
    logError('❌ Errore durante il reset password:', error);
    res.status(500).json({ message: "Errore durante il reset password" });
  }
});

module.exports = { router, authenticateToken };
