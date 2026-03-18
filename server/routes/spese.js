const express = require('express');
const Spesa = require('../models/Spesa');
const { authenticateToken } = require('./auth');
const router = express.Router();

// GET /api/spese (Paginated)
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG GET - req.user:', req.user);
    console.log('🔍 DEBUG GET - userId per filtro:', req.user.userId);
    
    // User isolation check
    if (!req.user || !req.user.userId) {
      console.log('🚫 Accesso negato - utente non autenticato');
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    console.log('✅ Utente autenticato:', req.user.username);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const userFilter = { userId: req.user.userId };
    console.log('🔍 DEBUG GET - filtro utilizzato:', userFilter);
    const totalSpese = await Spesa.countDocuments(userFilter);
    const spese = await Spesa.find(userFilter).sort({ data: -1 }).skip(skip).limit(limit);
    console.log('🔍 DEBUG GET - trovate', spese.length, 'spese per questo utente');
    
    // TEMPORARY SECURITY CHECK - Force isolation even if query fails
    const filteredSpese = spese.filter(spesa => 
      spesa.userId && spesa.userId.toString() === req.user.userId.toString()
    );
    console.log('🔒 SECURITY FILTER - dopo filtro security:', filteredSpese.length, 'spese');
    
    res.json({ 
      spese: filteredSpese, 
      currentPage: page, 
      totalPages: Math.ceil(filteredSpese.length / limit), 
      totalItems: filteredSpese.length 
    });
  } catch (err) {
    console.error('❌ Errore nel recupero delle spese:', err);
    res.status(500).json({ error: "Errore nel recupero delle spese" });
  }
});

// GET /api/spese/totale-mese
router.get('/totale-mese', authenticateToken, async (req, res) => {
  try {
    const oggi = new Date();
    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);
    const spese = await Spesa.find({ 
      userId: req.user.userId,
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
router.post('/', authenticateToken, async (req, res) => {
  console.log('👉 Ricevuto nel body:', req.body);
  console.log('🔍 DEBUG - req.user:', req.user);
  console.log('🔍 DEBUG - userId da token:', req.user.userId);
  const { descrizione, importo, categoria, data } = req.body;
  if (!importo) return res.status(400).json({ error: "Importo mancante", message: "Inserisci un importo valido" });
  if (!categoria) return res.status(400).json({ error: "Categoria mancante", message: "Seleziona una categoria" });
  const importoNumerico = Number(importo);
  if (isNaN(importoNumerico)) return res.status(400).json({ error: "Importo non valido", message: "L'importo deve essere un numero valido" });
  try {
    const nuovaSpesa = new Spesa({ 
      userId: req.user.userId,
      descrizione: descrizione || '', 
      importo: -Math.abs(importoNumerico), 
      categoria, 
      data: data ? new Date(data) : new Date() 
    });
    const spesaSalvata = await nuovaSpesa.save();
    res.status(201).json({ success: true, message: `Spesa di ${Math.abs(importoNumerico).toFixed(2)}€ aggiunta con successo`, data: spesaSalvata });
  } catch (err) {
    console.error('❌ Errore nel salvataggio della spesa:', err);
    res.status(500).json({ error: "Errore nel salvataggio", message: "Non è stato possibile salvare la spesa. Riprova." });
  }
});

// DELETE /api/spese/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  console.log('🗑️ Richiesta eliminazione spesa:', req.params.id);
  try {
    const spesa = await Spesa.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user.userId 
    });
    if (!spesa) return res.status(404).json({ error: "Spesa non trovata" });
    console.log('✅ Spesa eliminata con successo:', req.params.id);
    res.json({ message: "Spesa eliminata con successo" });
  } catch (err) {
    console.error('❌ Errore nella cancellazione della spesa:', err);
    res.status(500).json({ error: "Errore nella cancellazione della spesa" });
  }
});

// PUT /api/spese/:id
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { descrizione, importo, categoria, data } = req.body;
  if (!importo || !categoria) return res.status(400).json({ error: "Dati mancanti" });
  try {
    const spesa = await Spesa.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      { descrizione, importo: Number(importo), categoria, data: data ? new Date(data) : undefined },
      { new: true }
    );
    if (!spesa) return res.status(404).json({ error: "Spesa non trovata" });
    res.json(spesa);
  } catch (err) {
    console.error('❌ Errore nella modifica della spesa:', err);
    res.status(500).json({ error: "Errore nella modifica della spesa" });
  }
});

module.exports = router;