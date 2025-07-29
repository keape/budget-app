const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken } = require('./auth');
const TransazionePeriodica = require('../models/TransazionePeriodica');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const router = express.Router();

// Funzione helper per calcolare la prossima data
const calcolaDataTransazione = (config, dataBase, tipoRipetizione) => {
  const data = new Date(dataBase);
  
  switch (tipoRipetizione) {
    case 'giornaliera':
      data.setDate(data.getDate() + 1);
      break;
      
    case 'settimanale':
      data.setDate(data.getDate() + 7);
      break;
      
    case 'quindicinale':
      data.setDate(data.getDate() + 14);
      break;
      
    case 'mensile':
    case 'bimestrale':
    case 'trimestrale':
    case 'semestrale':
      const mesiDaAggiungere = config.ogni_n_mesi || 1;
      let nuovoMese = data.getMonth() + mesiDaAggiungere;
      let nuovoAnno = data.getFullYear();
      
      // Gestisci overflow dell'anno
      while (nuovoMese > 11) {
        nuovoMese -= 12;
        nuovoAnno++;
      }
      
      let nuovoGiorno = config.giorno;
      const ultimoGiornoMese = new Date(nuovoAnno, nuovoMese + 1, 0).getDate();
      
      // Gestisci giorno 31 che non esiste
      if (nuovoGiorno > ultimoGiornoMese) {
        if (config.gestione_giorno_mancante === 'ultimo_disponibile') {
          nuovoGiorno = ultimoGiornoMese;
        } else {
          // primo_disponibile: vai al primo del mese successivo
          nuovoMese = nuovoMese === 11 ? 0 : nuovoMese + 1;
          if (nuovoMese === 0) nuovoAnno++;
          nuovoGiorno = 1;
        }
      }
      
      data.setFullYear(nuovoAnno, nuovoMese, nuovoGiorno);
      break;
      
    case 'annuale':
      data.setFullYear(data.getFullYear() + 1, config.mese - 1, config.giorno);
      break;
      
    case 'personalizzata':
      data.setDate(data.getDate() + config.ogni_n_giorni);
      break;
  }
  
  return data;
};

// Funzione per generare tutte le date mancanti
const calcolaDateMancanti = (abbonamento) => {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  
  const dataInizio = new Date(abbonamento.data_inizio);
  dataInizio.setHours(0, 0, 0, 0);
  
  const dataFine = abbonamento.data_fine ? new Date(abbonamento.data_fine) : null;
  if (dataFine) dataFine.setHours(23, 59, 59, 999);
  
  const dateGenerate = abbonamento.transazioni_generate.map(t => {
    const d = new Date(t.data);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  
  const dateDaGenerare = [];
  let dataCorrente = new Date(dataInizio);
  
  // Prima transazione (data di inizio)
  if (dataCorrente.getTime() <= oggi.getTime() && 
      !dateGenerate.includes(dataCorrente.getTime()) &&
      (!dataFine || dataCorrente.getTime() <= dataFine.getTime())) {
    dateDaGenerare.push(new Date(dataCorrente));
  }
  
  // Genera date successive
  while (true) {
    dataCorrente = calcolaDataTransazione(
      abbonamento.configurazione, 
      dataCorrente, 
      abbonamento.tipo_ripetizione
    );
    
    // Ferma se supera oggi o la data fine
    if (dataCorrente.getTime() > oggi.getTime()) break;
    if (dataFine && dataCorrente.getTime() > dataFine.getTime()) break;
    
    // Aggiungi se non già generata
    if (!dateGenerate.includes(dataCorrente.getTime())) {
      dateDaGenerare.push(new Date(dataCorrente));
    }
  }
  
  return dateDaGenerare;
};

// GET - Lista tutte le transazioni periodiche dell'utente (attive e sospese)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const transazioni = await TransazionePeriodica.find({ 
      userId: req.user.userId
      // Rimuove il filtro attiva: true per mostrare anche quelle sospese
    }).sort({ createdAt: -1 });
    
    res.json(transazioni);
  } catch (error) {
    console.error('Errore nel recupero transazioni periodiche:', error);
    res.status(500).json({ message: 'Errore del server' });
  }
});

// POST - Crea una nuova transazione periodica
router.post('/', authenticateToken, async (req, res) => {
  try {
    const transazionePeriodica = new TransazionePeriodica({
      ...req.body,
      userId: req.user.userId
    });
    
    await transazionePeriodica.save();
    
    console.log(`✅ Abbonamento creato: ${transazionePeriodica.descrizione} per utente ${req.user.username}`);
    res.status(201).json(transazionePeriodica);
  } catch (error) {
    console.error('Errore nella creazione transazione periodica:', error);
    res.status(400).json({ message: 'Errore nella creazione', error: error.message });
  }
});

// PUT - Modifica una transazione periodica (non retroattiva)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const transazione = await TransazionePeriodica.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });
    
    if (!transazione) {
      return res.status(404).json({ message: 'Transazione periodica non trovata' });
    }
    
    // Incrementa versione per tracciare modifiche non retroattive
    const aggiornamenti = {
      ...req.body,
      versione: transazione.versione + 1,
      // Mantiene le transazioni già generate
      transazioni_generate: transazione.transazioni_generate
    };
    
    const transazioneAggiornata = await TransazionePeriodica.findByIdAndUpdate(
      req.params.id,
      aggiornamenti,
      { new: true }
    );
    
    console.log(`✅ Abbonamento modificato: ${transazioneAggiornata.descrizione}`);
    res.json(transazioneAggiornata);
  } catch (error) {
    console.error('Errore nella modifica transazione periodica:', error);
    res.status(400).json({ message: 'Errore nella modifica', error: error.message });
  }
});

// PATCH - Cambia stato (attiva/sospendi) di una transazione periodica
router.patch('/:id/stato', authenticateToken, async (req, res) => {
  try {
    const { attiva } = req.body;
    
    const transazione = await TransazionePeriodica.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { attiva: attiva },
      { new: true }
    );
    
    if (!transazione) {
      return res.status(404).json({ message: 'Transazione periodica non trovata' });
    }
    
    const azione = attiva ? 'attivato' : 'sospeso';
    console.log(`${attiva ? '✅' : '⏸️'} Abbonamento ${azione}: ${transazione.descrizione}`);
    res.json({ 
      message: `Transazione periodica ${azione}`, 
      transazione: transazione 
    });
  } catch (error) {
    console.error('Errore nel cambio stato transazione periodica:', error);
    res.status(500).json({ message: 'Errore del server' });
  }
});

// DELETE - Elimina/disattiva una transazione periodica
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const transazione = await TransazionePeriodica.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { attiva: false },
      { new: true }
    );
    
    if (!transazione) {
      return res.status(404).json({ message: 'Transazione periodica non trovata' });
    }
    
    console.log(`❌ Abbonamento disattivato: ${transazione.descrizione}`);
    res.json({ message: 'Transazione periodica disattivata' });
  } catch (error) {
    console.error('Errore nella cancellazione transazione periodica:', error);
    res.status(500).json({ message: 'Errore del server' });
  }
});

// POST - Genera transazioni mancanti (endpoint principale)
router.post('/genera', authenticateToken, async (req, res) => {
  try {
    console.log(`🔄 Generazione transazioni per utente: ${req.user.username}`);
    
    const abbonamentiAttivi = await TransazionePeriodica.find({
      userId: req.user.userId,
      attiva: true
    });
    
    let transazioniCreate = [];
    let notifiche = [];
    
    for (const abbonamento of abbonamentiAttivi) {
      const dateDaGenerare = calcolaDateMancanti(abbonamento);
      
      for (const data of dateDaGenerare) {
        // Crea la transazione normale
        const datiTransazione = {
          userId: req.user.userId,
          importo: abbonamento.importo,
          categoria: abbonamento.categoria,
          descrizione: `${abbonamento.descrizione} (Auto)`,
          data: data
        };
        
        let nuovaTransazione;
        if (abbonamento.importo < 0) {
          // È una spesa
          nuovaTransazione = new Spesa(datiTransazione);
        } else {
          // È un'entrata
          nuovaTransazione = new Entrata(datiTransazione);
        }
        
        await nuovaTransazione.save();
        
        // Aggiorna il tracking nell'abbonamento
        abbonamento.transazioni_generate.push({
          data: data,
          transazione_id: nuovaTransazione._id
        });
        
        transazioniCreate.push({
          ...datiTransazione,
          _id: nuovaTransazione._id
        });
        
        // Crea notifica
        notifiche.push({
          tipo: 'transazione_generata',
          messaggio: `${abbonamento.descrizione} ${Math.abs(abbonamento.importo).toFixed(2)}€ - Abbonamento creato`,
          data: new Date(),
          icona: '🔄'
        });
        
        console.log(`✅ Transazione generata: ${abbonamento.descrizione} - ${data.toLocaleDateString('it-IT')}`);
      }
      
      // Salva il tracking aggiornato
      await abbonamento.save();
    }
    
    res.json({
      success: true,
      transazioni_create: transazioniCreate,
      notifiche: notifiche,
      messaggio: `${transazioniCreate.length} transazioni generate`
    });
    
  } catch (error) {
    console.error('❌ Errore nella generazione transazioni:', error);
    res.status(500).json({ message: 'Errore nella generazione transazioni', error: error.message });
  }
});

// GET - Anteprima prossime transazioni
router.get('/anteprima/:id', authenticateToken, async (req, res) => {
  try {
    const abbonamento = await TransazionePeriodica.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });
    
    if (!abbonamento) {
      return res.status(404).json({ message: 'Abbonamento non trovato' });
    }
    
    // Calcola prossime 6 occorrenze
    const prossimeDate = [];
    let dataCorrente = new Date();
    dataCorrente.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 6; i++) {
      dataCorrente = calcolaDataTransazione(
        abbonamento.configurazione, 
        dataCorrente, 
        abbonamento.tipo_ripetizione
      );
      
      if (abbonamento.data_fine && dataCorrente > new Date(abbonamento.data_fine)) {
        break;
      }
      
      prossimeDate.push(new Date(dataCorrente));
    }
    
    res.json({ prossime_date: prossimeDate });
  } catch (error) {
    console.error('Errore nel calcolo anteprima:', error);
    res.status(500).json({ message: 'Errore del server' });
  }
});

module.exports = router;