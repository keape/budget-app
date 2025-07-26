const express = require('express');
const Entrata = require('../models/Entrata');
const { authenticateToken } = require('./auth');
const router = express.Router();

// GET /api/entrate (Paginated)
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG ENTRATE - req.user:', req.user);
    
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
    const totalEntrate = await Entrata.countDocuments(userFilter);
    const entrate = await Entrata.find(userFilter).sort({ data: -1 }).skip(skip).limit(limit);
    
    // TEMPORARY SECURITY CHECK - Force isolation even if query fails
    const filteredEntrate = entrate.filter(entrata => 
      entrata.userId && entrata.userId.toString() === req.user.userId.toString()
    );
    console.log('🔒 SECURITY FILTER entrate - dopo filtro security:', filteredEntrate.length, 'entrate');
    
    res.json({ 
      entrate: filteredEntrate, 
      currentPage: page, 
      totalPages: Math.ceil(filteredEntrate.length / limit), 
      totalItems: filteredEntrate.length 
    });
  } catch (err) {
    console.error('❌ Errore nel recupero delle entrate:', err);
    res.status(500).json({ error: "Errore nel recupero delle entrate" });
  }
});

// GET /api/entrate/totale-mese
router.get('/totale-mese', authenticateToken, async (req, res) => {
  try {
    const oggi = new Date();
    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);
    const entrate = await Entrata.find({ 
      userId: req.user.userId,
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
router.post('/', authenticateToken, async (req, res) => {
  const { descrizione, importo, categoria, data } = req.body;
  if (!importo) return res.status(400).json({ error: "Importo mancante", message: "Inserisci un importo valido" });
  if (!categoria) return res.status(400).json({ error: "Categoria mancante", message: "Seleziona una categoria" });
  const importoNumerico = Number(importo);
  if (isNaN(importoNumerico)) return res.status(400).json({ error: "Importo non valido", message: "L'importo deve essere un numero valido" });
  try {
    const nuovaEntrata = new Entrata({ 
      userId: req.user.userId,
      descrizione: descrizione || '', 
      importo: Math.abs(importoNumerico), 
      categoria, 
      data: data ? new Date(data) : new Date() 
    });
    const entrataSalvata = await nuovaEntrata.save();
    res.status(201).json({ success: true, message: `Entrata di ${Math.abs(importoNumerico).toFixed(2)}€ aggiunta con successo`, data: entrataSalvata });
  } catch (err) {
    console.error("❌ Errore nel salvataggio dell'entrata:", err);
    res.status(500).json({ error: "Errore nel salvataggio", message: "Non è stato possibile salvare l'entrata. Riprova." });
  }
});

// PUT /api/entrate/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { importo, descrizione, categoria, data } = req.body;
    if (!importo || !categoria) return res.status(400).json({ error: "Importo e categoria sono richiesti" });
    const importoNumerico = Number(importo);
    if (isNaN(importoNumerico)) return res.status(400).json({ error: "L'importo deve essere un numero valido" });
    const entrata = await Entrata.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      { descrizione: descrizione || '', importo: Math.abs(importoNumerico), categoria, data: data ? new Date(data) : undefined },
      { new: true }
    );
    if (!entrata) return res.status(404).json({ error: "Entrata non trovata" });
    res.json(entrata);
  } catch (err) {
    console.error("❌ Errore nella modifica dell'entrata:", err);
    res.status(500).json({ error: "Errore nella modifica dell'entrata" });
  }
});

// DELETE /api/entrate/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  console.log('🗑️ Richiesta eliminazione entrata:', req.params.id);
  try {
    const entrata = await Entrata.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user.userId 
    });
    if (!entrata) return res.status(404).json({ error: "Entrata non trovata" });
    console.log('✅ Entrata eliminata con successo:', req.params.id);
    res.json({ message: "Entrata eliminata con successo" });
  } catch (err) {
    console.error("❌ Errore nella cancellazione dell'entrata:", err);
    res.status(500).json({ error: "Errore nella cancellazione dell'entrata" });
  }
});

module.exports = router;