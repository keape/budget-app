// Fallback per quando nodemailer non è disponibile
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (error) {
  console.warn('⚠️ nodemailer non disponibile, usando mock email service');
  nodemailer = null;
}

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Se nodemailer non è disponibile, usa sempre mock transporter
    if (!nodemailer) {
      console.warn('⚠️ EMAIL: nodemailer non disponibile, usando mock transporter');
      this.transporter = {
        sendMail: async (mailOptions) => {
          console.log('📧 MOCK EMAIL inviata (nodemailer non disponibile):', {
            to: mailOptions.to,
            subject: mailOptions.subject,
            text: mailOptions.text,
            otpCode: mailOptions.text.match(/\b\d{6}\b/)?.[0] || 'N/A'
          });
          return { messageId: 'mock-no-nodemailer-' + Date.now() };
        }
      };
      return;
    }

    // Configurazione per diversi provider email
    const emailConfig = {
      service: process.env.EMAIL_SERVICE || 'gmail', // gmail, outlook, etc.
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    };

    // Se non ci sono credenziali email, usa un mock transporter per sviluppo
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('⚠️ EMAIL: Credenziali email non configurate, usando mock transporter');
      this.transporter = {
        sendMail: async (mailOptions) => {
          console.log('📧 MOCK EMAIL inviata:', {
            to: mailOptions.to,
            subject: mailOptions.subject,
            text: mailOptions.text,
            html: mailOptions.html,
            otpCode: mailOptions.text.match(/\b\d{6}\b/)?.[0] || 'N/A'
          });
          return { messageId: 'mock-' + Date.now() };
        }
      };
      return;
    }

    try {
      this.transporter = nodemailer.createTransporter(emailConfig);
      console.log('✅ EMAIL: Transporter configurato con successo');
    } catch (error) {
      console.error('❌ EMAIL: Errore configurazione transporter:', error);
      // Fallback al mock transporter
      this.transporter = {
        sendMail: async (mailOptions) => {
          console.log('📧 FALLBACK EMAIL:', mailOptions);
          return { messageId: 'fallback-' + Date.now() };
        }
      };
    }
  }

  async sendOTP(email, otpCode, username) {
    const subject = 'Codice di Verifica - Budget App';
    const text = `
Ciao ${username},

Il tuo codice di verifica per accedere alla Budget App è:

${otpCode}

Questo codice scadrà tra 10 minuti.

Se non hai richiesto questo codice, ignora questa email.

Budget App Team
    `;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f9f9f9; }
    .otp-code { 
      font-size: 32px; 
      font-weight: bold; 
      color: #4F46E5; 
      text-align: center; 
      padding: 20px; 
      background: white; 
      border: 2px dashed #4F46E5; 
      margin: 20px 0; 
      border-radius: 8px;
    }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Budget App - Verifica Accesso</h1>
    </div>
    <div class="content">
      <h2>Ciao ${username}!</h2>
      <p>Il tuo codice di verifica per accedere alla Budget App è:</p>
      
      <div class="otp-code">${otpCode}</div>
      
      <p><strong>⏰ Questo codice scadrà tra 10 minuti.</strong></p>
      <p>Se non hai richiesto questo codice, ignora questa email.</p>
    </div>
    <div class="footer">
      <p>Budget App Team</p>
      <p>Questo è un messaggio automatico, non rispondere a questa email.</p>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject,
      text,
      html
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ EMAIL OTP inviata:', {
        to: email,
        messageId: result.messageId,
        otpCode: otpCode // Solo per debug, rimuovere in produzione
      });
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ EMAIL: Errore invio OTP:', error);
      return { success: false, error: error.message };
    }
  }

  // Funzione helper per generare OTP
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 cifre
  }

  // Verifica se l'email è valida (regex base)
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

module.exports = new EmailService();