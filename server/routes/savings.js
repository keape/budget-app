const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken } = require('./auth');
const SavingsMonth = require('../models/SavingsMonth');
const InstrumentAllocation = require('../models/InstrumentAllocation');
const AllocationPlan = require('../models/AllocationPlan');
const Entrata = require('../models/Entrata');
const Spesa = require('../models/Spesa');
const router = express.Router();

// GET /api/savings/months
router.get('/months', authenticateToken, async (req, res) => {
  try {
    const months = await SavingsMonth.find({ userId: req.user.userId }).sort({ anno: -1, mese: -1 });
    return res.json({ success: true, data: months });
  } catch (err) {
    console.error('Error fetching savings months:', err);
    res.status(500).json({ success: false, error: 'Error fetching savings months' });
  }
});

// POST /api/savings/ensure-month
// Creates (or updates) a SavingsMonth for any given past month by computing income/expenses from transactions.
router.post('/ensure-month', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { anno, mese } = req.body;

    if (anno == null || mese == null) {
      return res.status(400).json({ success: false, error: 'anno and mese are required' });
    }

    const targetAnno = parseInt(anno, 10);
    const targetMese = parseInt(mese, 10);

    // Don't allow current or future months
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    if (targetAnno > currentYear || (targetAnno === currentYear && targetMese >= currentMonth)) {
      return res.status(400).json({ success: false, error: 'Cannot ensure a current or future month' });
    }

    // Return existing if already present
    const existing = await SavingsMonth.findOne({ userId, anno: targetAnno, mese: targetMese });
    if (existing) {
      return res.json({ success: true, data: existing, alreadyExists: true });
    }

    // Compute income and expenses from transactions
    const startDate = new Date(targetAnno, targetMese, 1);
    const endDate = new Date(targetAnno, targetMese + 1, 1);

    const entrate = await Entrata.find({ userId, data: { $gte: startDate, $lt: endDate } });
    const income = entrate.reduce((sum, e) => sum + e.importo, 0);

    const spese = await Spesa.find({ userId, data: { $gte: startDate, $lt: endDate } });
    const expenses = spese.reduce((sum, s) => sum + Math.abs(s.importo), 0);

    const savings = income - expenses;

    const savedMonth = await SavingsMonth.create({
      userId,
      anno: targetAnno,
      mese: targetMese,
      income,
      expenses,
      savings,
      status: 'closed',
      closedAt: new Date(),
    });

    return res.status(201).json({ success: true, data: savedMonth, alreadyExists: false });
  } catch (err) {
    console.error('Error in ensure-month:', err);
    res.status(500).json({ success: false, error: 'Error ensuring month' });
  }
});

// POST /api/savings/auto-close
router.post('/auto-close', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const prevMese = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevAnno = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    // Check if already closed
    const existing = await SavingsMonth.findOne({ userId, anno: prevAnno, mese: prevMese, status: 'closed' });
    if (existing) {
      return res.json({ success: true, data: existing, alreadyClosed: true });
    }

    // Sum income
    const startDate = new Date(prevAnno, prevMese, 1);
    const endDate = new Date(prevAnno, prevMese + 1, 1);
    const entrate = await Entrata.find({ userId, data: { $gte: startDate, $lt: endDate } });
    const income = entrate.reduce((sum, e) => sum + e.importo, 0);

    // Sum expenses (importo is negative, use Math.abs)
    const spese = await Spesa.find({ userId, data: { $gte: startDate, $lt: endDate } });
    const expenses = spese.reduce((sum, s) => sum + Math.abs(s.importo), 0);

    const savings = income - expenses;

    // Upsert SavingsMonth
    const savedMonth = await SavingsMonth.findOneAndUpdate(
      { userId, anno: prevAnno, mese: prevMese },
      { $set: { income, expenses, savings, status: 'closed', closedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // If savings < 0, find conto_corrente instrument in user's plan and record allocation
    if (savings < 0) {
      try {
        const plan = await AllocationPlan.findOne({ userId }).populate('allocations.instrumentId');
        if (plan) {
          const contoEntry = plan.allocations.find(
            a => a.instrumentId && a.instrumentId.type === 'conto_corrente'
          );
          if (contoEntry) {
            await InstrumentAllocation.create({
              userId,
              savingsMonthId: savedMonth._id,
              instrumentId: contoEntry.instrumentId._id,
              amount: savings // negative
            });
          }
        }
      } catch (planErr) {
        // Skip silently if no plan or no conto_corrente instrument
        console.warn('Could not auto-allocate negative savings to conto_corrente:', planErr.message);
      }
    }

    return res.json({ success: true, data: savedMonth, alreadyClosed: false });
  } catch (err) {
    console.error('Error in auto-close:', err);
    res.status(500).json({ success: false, error: 'Error closing month' });
  }
});

// GET /api/savings/months/:id/allocations
router.get('/months/:id/allocations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const month = await SavingsMonth.findOne({ _id: req.params.id, userId });
    if (!month) {
      return res.status(404).json({ success: false, error: 'Savings month not found' });
    }
    const allocations = await InstrumentAllocation.find({ userId, savingsMonthId: req.params.id }).populate('instrumentId');
    return res.json({ success: true, data: allocations });
  } catch (err) {
    console.error('Error fetching allocations:', err);
    res.status(500).json({ success: false, error: 'Error fetching allocations' });
  }
});

// POST /api/savings/months/:id/allocations
router.post('/months/:id/allocations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const id = req.params.id;
    const { instrumentId, amount, quantity, priceAtAllocation } = req.body;

    // Validate required fields
    if (!instrumentId || amount == null) {
      return res.status(400).json({ success: false, error: 'instrumentId and amount are required' });
    }

    const month = await SavingsMonth.findOne({ _id: id, userId });
    if (!month) {
      return res.status(404).json({ success: false, error: 'Savings month not found' });
    }

    const created = await InstrumentAllocation.create({
      userId,
      savingsMonthId: id,
      instrumentId,
      amount,
      quantity,
      priceAtAllocation
    });

    const allocation = await created.populate('instrumentId');
    return res.status(201).json({ success: true, data: allocation });
  } catch (err) {
    console.error('Error creating allocation:', err);
    res.status(500).json({ success: false, error: 'Error creating allocation' });
  }
});

// DELETE /api/savings/months/:id/allocations/:allId
router.delete('/months/:id/allocations/:allId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deleted = await InstrumentAllocation.findOneAndDelete({
      _id: req.params.allId,
      userId,
      savingsMonthId: req.params.id
    });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Allocation not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting allocation:', err);
    res.status(500).json({ success: false, error: 'Error deleting allocation' });
  }
});

// GET /api/savings/plan
router.get('/plan', authenticateToken, async (req, res) => {
  try {
    const plan = await AllocationPlan.findOne({ userId: req.user.userId }).populate('allocations.instrumentId');
    if (!plan) {
      return res.json({ success: true, data: null });
    }
    return res.json({ success: true, data: plan });
  } catch (err) {
    console.error('Error fetching allocation plan:', err);
    res.status(500).json({ success: false, error: 'Error fetching allocation plan' });
  }
});

// PUT /api/savings/plan
router.put('/plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { allocations } = req.body;

    if (!Array.isArray(allocations)) {
      return res.status(400).json({ success: false, error: 'allocations must be an array' });
    }

    // Validate each entry
    for (const alloc of allocations) {
      if (alloc.targetPercentage == null || typeof alloc.targetPercentage !== 'number' || alloc.targetPercentage < 0 || alloc.targetPercentage > 100) {
        return res.status(400).json({ success: false, error: 'targetPercentage must be a number between 0 and 100' });
      }
    }

    const total = allocations.reduce((sum, a) => sum + (a.targetPercentage || 0), 0);
    const warning = total < 100 ? `Total allocation is ${total}% (partial plan)` : undefined;

    const plan = await AllocationPlan.findOneAndUpdate(
      { userId },
      { $set: { allocations } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await plan.populate('allocations.instrumentId');

    const response = { success: true, data: plan };
    if (warning) response.warning = warning;
    return res.json(response);
  } catch (err) {
    console.error('Error updating allocation plan:', err);
    res.status(500).json({ success: false, error: 'Error updating allocation plan' });
  }
});

// GET /api/savings/portfolio
router.get('/portfolio', authenticateToken, async (req, res) => {
  try {
    const results = await InstrumentAllocation.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.userId) } },
      {
        $group: {
          _id: '$instrumentId',
          totalAmount: { $sum: '$amount' },
          totalQuantity: { $sum: { $ifNull: ['$quantity', 0] } }
        }
      },
      {
        $lookup: {
          from: 'instruments',
          localField: '_id',
          foreignField: '_id',
          as: 'instrument'
        }
      },
      { $unwind: '$instrument' }
    ]);

    const data = results.map(r => {
      let estimatedCurrentValue = null;
      if (r.totalQuantity > 0 && r.instrument.lastPrice != null) {
        estimatedCurrentValue = r.totalQuantity * r.instrument.lastPrice;
      }
      return {
        instrument: r.instrument,
        totalAmount: r.totalAmount,
        totalQuantity: r.totalQuantity,
        estimatedCurrentValue
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching portfolio:', err);
    res.status(500).json({ success: false, error: 'Error fetching portfolio' });
  }
});

module.exports = router;
